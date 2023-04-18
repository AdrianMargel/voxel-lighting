function initLight(){
	let lightVs=glsl`#version 300 es
		in vec4 position;

		void main() {
			gl_Position = position;
		}
	`;

	let lightFs=glsl`#version 300 es
		precision highp float;

		uniform vec2 resolution;

		${commonVariables}
		uniform sampler2D lightA;

		uniform vec3 randomOffset;

		out vec3 outColor;

		${commonFunctions}

		vec3 getLightAtIdx2(highp uint idx){
			uint width=uint(lightResolution.x);
			vec2 halfPix=vec2(0.5,0.5);
		
			uint y=idx/width;
			uint x=idx-(y*width);
		
			vec2 idxPos=vec2(x,y);
			//make sure to sample from the center of the pixel
			idxPos+=halfPix;
			if(idxPos.y>=lightResolution.y){
				return vec3(0.,0.,0.);
			}
			return texture(lightA, idxPos/lightResolution).rgb;
		}

		uint getFaceIdx(vec3 rot){
			//+X,-X,+Y,-Y,+Z,-Z
			if(rot.x==1.){
				return uint(0);
			}else if(rot.x==-1.){
				return uint(1);
			}else if(rot.y==1.){
				return uint(2);
			}else if(rot.y==-1.){
				return uint(3);
			}else if(rot.z==1.){
				return uint(4);
			}else if(rot.z==-1.){
				return uint(5);
			}
			//should never reach this
			return uint(0);
		}

		highp uvec2 getSideVoxelFace(vec3 side,highp uint voxIdx,uint faceIdx,vec3 pos,vec3 dir){
			//keep in mind voxel indexes start at 1
			vec3 toTest=pos+side+dir;
			highp uint idx=getAtPos(toTest.x,toTest.y,toTest.z).y;
			if(idx!=uint(0)){
				return uvec2(idx-uint(1),getFaceIdx(side));
			}

			toTest=pos+side;
			idx=getAtPos(toTest.x,toTest.y,toTest.z).y;
			if(idx!=uint(0)){
				return uvec2(idx-uint(1),faceIdx);
			}

			return uvec2(voxIdx,getFaceIdx(-side));
		}
		vec4 getSideAverage(vec3 side,highp uint voxIdx,uint faceIdx,vec3 pos,vec3 dir,vec3 normal){
			uvec2 sideVoxFace=getSideVoxelFace(side,voxIdx,faceIdx,pos,dir);
			vec3 sideNrm=vec3(
				getFaceAtIdx(sideVoxFace.x,sideVoxFace.y,uint(3)),
				getFaceAtIdx(sideVoxFace.x,sideVoxFace.y,uint(4)),
				getFaceAtIdx(sideVoxFace.x,sideVoxFace.y,uint(5))
			);
			float compare=max(dot(sideNrm,normal),0.);

			if(compare==0.){
				return vec4(0.);
			}
			
			highp uint lightIdx=sideVoxFace.x*uint(6)+sideVoxFace.y;
			vec3 sideLight=getLightAtIdx2(lightIdx);
			return vec4(sideLight*compare,compare);
		}
		vec3 average(highp uint voxIdx, uint faceIdx, vec3 pos, vec3 dir, vec3 normal){

			vec3 side1;
			vec3 side2;
			if(dir.x!=0.){
				side1=vec3(0.,1.,0.);
				side2=vec3(0.,0.,1.);
			}else if(dir.y!=0.){
				side1=vec3(1.,0.,0.);
				side2=vec3(0.,0.,1.);
			}else if(dir.z!=0.){
				side1=vec3(1.,0.,0.);
				side2=vec3(0.,1.,0.);
			}
			
			vec4 result1a=getSideAverage(side1,
				voxIdx,faceIdx,pos,dir,normal
			);
			side1*=-1.;
			vec4 result1b=getSideAverage(side1,
				voxIdx,faceIdx,pos,dir,normal
			);

			vec4 result2a=getSideAverage(side2,
				voxIdx,faceIdx,pos,dir,normal
			);
			side2*=-1.;
			vec4 result2b=getSideAverage(side2,
				voxIdx,faceIdx,pos,dir,normal
			);

			vec4 result=result1a+result1b+result2a+result2b;
			if(result[3]>0.){
				return result.rgb/result[3];
			}
			return vec3(-1.);
		}

		vec3 rayTrace(highp uint voxIdx, uint faceIdx, vec3 pos, vec3 dir, vec3 normal, int rayCount,int maxSteps){

			float small=0.001;

			vec3 normalX=normal;
			vec3 normalCompare;
			if(normalX.y>(1.-small)||normalX.y<(-1.+small)){
				normalCompare=vec3(1.,0.,0.);
			}else{
				normalCompare=vec3(0.,1.,0.);
			}
			vec3 normalY=normalize(cross(normalCompare,normalX));
			vec3 normalZ=normalize(cross(normalY,normalX));

			pos+=vec3(.5,.5,.5);
			pos+=dir*(.5-small);

			vec3 col=vec3(0.,0.,0.);

			float successRays=0.;

			for(int i=0;i<rayCount;i++){
				vec3 offset=hash33(pos+randomOffset+float(i));
				//offset yz=-1,1 x=0,1
				offset=vec3(offset.x,offset.y*2.-1.,offset.z*2.-1.);

				vec3 rayDir=vec3((offset.x*normalX)+(offset.y*normalY)+(offset.z*normalZ));

				vec3 rayResult=castRay(pos,rayDir,maxSteps);
				if(rayResult.x>=0.&&rayResult.y>=0.&&rayResult.z>=0.){
					successRays++;
					col+=rayResult;
				}
			}
			if(successRays>0.){
				col/=successRays;
				return col;
			}
			return vec3(-1.);
		}

		void main(){
			vec2 coord=gl_FragCoord.xy;
			vec2 uv=gl_FragCoord.xy/resolution;
			vec2 uv2=vec2(uv.x*2.-1.,uv.y*2.-1.);

			highp uint idx=uint(coord.x)+(uint(coord.y)*uint(resolution.x));

			highp uint voxIdx=idx;
			voxIdx/=uint(6);
			uint faceIdx=idx-voxIdx*uint(6);
			
			vec3 pos=vec3(
				getVoxAtIdx(voxIdx,uint(0)),
				getVoxAtIdx(voxIdx,uint(1)),
				getVoxAtIdx(voxIdx,uint(2))
			);

			float randomNum=hash13(pos+randomOffset);
			if(randomNum>1./1.){
				outColor=getLightAtIdx(idx);
				return;
			}

			vec3 dir;
			//+X,-X,+Y,-Y,+Z,-Z
			if(faceIdx==uint(0)){
				dir=vec3(1.,0.,0.);
			}else if(faceIdx==uint(1)){
				dir=vec3(-1.,0.,0.);
			}else if(faceIdx==uint(2)){
				dir=vec3(0.,1.,0.);
			}else if(faceIdx==uint(3)){
				dir=vec3(0.,-1.,0.);
			}else if(faceIdx==uint(4)){
				dir=vec3(0.,0.,1.);
			}else if(faceIdx==uint(5)){
				dir=vec3(0.,0.,-1.);
			}
			dir*=-1.;

			vec3 frontPos=pos+dir;
			if(getAtPos(frontPos.x,frontPos.y,frontPos.z).y!=uint(0)){
				outColor=vec3(-1.);
				return;
			}

			vec3 normal=vec3(
				getFaceAtIdx(voxIdx,faceIdx,uint(3)),
				getFaceAtIdx(voxIdx,faceIdx,uint(4)),
				getFaceAtIdx(voxIdx,faceIdx,uint(5))
			);

			vec3 existingLight=getLightAtIdx(idx);
			// vec3 directLight=lightTrace(voxIdx,
			// 	faceIdx,
			// 	pos,
			// 	dir,
			// 	normal,
			// 	1,
			// 	50
			// );
			vec3 ambientLight=rayTrace(
				voxIdx,
				faceIdx,
				pos,
				dir,
				normal,
				1,
				50
			);
			vec3 blurLight=average(
				voxIdx,
				faceIdx,
				pos,
				dir,
				normal
			);
			vec3 light=existingLight;
			if(blurLight.x>=0.){
				light=mix(light,blurLight,1.);
				if(ambientLight.x>=0.){
					light=mix(light,ambientLight,0.1);
				}
			}else{
				//TODO: consider blur weights so that lighting works correctly on complex geometries
				if(ambientLight.x>=0.){
					light=ambientLight;
				}
				// light*=.0;
			}

			// light=vec3(.5);
			// light+=directLight;
			outColor=light;
		}
	`;
	
	const programInfo = twgl.createProgramInfo(gl, [lightVs, lightFs]);

	const arrays = {
		position: {
			numComponents: 2,
			data:[
				-1, 1,
				1, -1,
				1, 1,
				-1, 1,
				1, -1,
				-1, -1,
			]
		},
	};
	const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

	return {
		programInfo,
		bufferInfo,
	};
}

function light(lightProgram,ping) {
	const uniforms = {
		resolution: [mapTextures.lightPing.width,mapTextures.lightPing.height],

		randomOffset: [Math.random()*2-1,Math.random()*2-1,Math.random()*2-1],

		voxResolution: [mapTextures.voxels.width,mapTextures.voxels.height],
		voxels: textures.voxels,
		lightResolution: [mapTextures.lightPing.width,mapTextures.lightPing.height],
		lightA: ping?textures.lightPong:textures.lightPing,
		light: textures.lightSmoothPing,
		octResolution: [mapTextures.octree.width,mapTextures.octree.height],
		octree: textures.octree,
	};
	
	const attachments = [
		{ attachment: ping?textures.lightPing:textures.lightPong },
	];
	const frameBuffer = twgl.createFramebufferInfo(gl, attachments, mapTextures.lightPing.width,mapTextures.lightPing.height);
	
	twgl.bindFramebufferInfo(gl,frameBuffer);

	gl.useProgram(lightProgram.programInfo.program);
	twgl.setBuffersAndAttributes(gl, lightProgram.programInfo, lightProgram.bufferInfo);
	twgl.setUniforms(lightProgram.programInfo, uniforms);
	twgl.drawBufferInfo(gl, lightProgram.bufferInfo);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}