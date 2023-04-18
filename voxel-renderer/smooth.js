function initSmoothLight(){
	let lightVs=glsl`#version 300 es
		in vec4 position;

		void main() {
			gl_Position = position;
		}
	`;

	let lightFs=glsl`#version 300 es
		precision highp float;

		uniform vec2 resolution;

		// uniform vec2 lightResolution;
		uniform sampler2D lightPing;
		uniform sampler2D lightPong;
		// uniform sampler2D lightSmooth;
		
		${commonVariables}

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

			vec3 l1=texture(lightPing, idxPos/lightResolution).rgb;
			if(l1.r<0.){
				return l1;
			}
			// vec3 l2=texture(lightPong, idxPos/lightResolution).rgb;
			// vec3 lOrigin=min(l1,l2);
			// vec3 lOrigin=mix(l1,l2,.5);
			vec3 lOrigin=l1;
			// return l1;

			vec3 lSmooth=texture(light, idxPos/lightResolution).rgb;
			return gammaShift(mix(gammaCorrect(lSmooth),gammaCorrect(lOrigin),0.01));
			// return mix(lSmooth,lOrigin,0.01);
		}
		vec3 lightTrace(vec3 lDir, vec3 lCol, highp uint voxIdx, uint faceIdx, vec3 pos, vec3 dir, vec3 normal, int rayCount,int maxSteps){
			
			float small=0.001;
			
			vec3 lt=normalize(lDir);
			float relation=dot(lt,normal);
			if(relation<=0.){
				return vec3(0.);
			}

			pos+=vec3(.5,.5,.5);
			pos+=dir*(.5-small);

			vec3 rayResult=castRay(pos,lt,maxSteps);
			if(rayResult.b==1.){//TODO
				return lCol*relation;
			}
			return vec3(0.);
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

			vec3 directLight=lightTrace(
				vec3(0.5,1.,0.4),
				(vec3(0.7,.4,0.)+vec3(1.))*.5,

				voxIdx,
				faceIdx,
				pos,
				dir,
				normal,
				1,
				50
			);

			vec3 light=getLightAtIdx2(idx);
			outColor=light+directLight;
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

function smoothLight(lightProgram,ping) {
	const uniforms = {
		resolution: [mapTextures.lightPing.width,mapTextures.lightPing.height],

		voxResolution: [mapTextures.voxels.width,mapTextures.voxels.height],
		voxels: textures.voxels,
		lightResolution: [mapTextures.lightPing.width,mapTextures.lightPing.height],
		lightPing: textures.lightPing,
		lightPong: textures.lightPong,
		light: ping?textures.lightSmoothPing:textures.lightSmoothPong,
		octResolution: [mapTextures.octree.width,mapTextures.octree.height],
		octree: textures.octree,
	};
	
	const attachments = [
		{ attachment: ping?textures.lightSmoothPong:textures.lightSmoothPing },
	];
	const frameBuffer = twgl.createFramebufferInfo(gl, attachments, mapTextures.lightPing.width,mapTextures.lightPing.height);
	
	twgl.bindFramebufferInfo(gl,frameBuffer);

	gl.useProgram(lightProgram.programInfo.program);
	twgl.setBuffersAndAttributes(gl, lightProgram.programInfo, lightProgram.bufferInfo);
	twgl.setUniforms(lightProgram.programInfo, uniforms);
	twgl.drawBufferInfo(gl, lightProgram.bufferInfo);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}