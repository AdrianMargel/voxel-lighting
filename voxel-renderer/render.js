function initRender(){
	let renderVs=glsl`#version 300 es
		in vec4 position;

		void main() {
			gl_Position = position;
		}
	`;

	let renderFs=glsl`#version 300 es
		precision highp float;

		uniform vec2 resolution;

		${commonVariables}

		uniform vec3 position;
		uniform vec3 xRot;
		uniform vec3 yRot;
		uniform vec3 zRot;

		out vec4 outColor;

		${commonFunctions}

		vec3 rayTrace(vec2 coord){
			float ratio=resolution.x/resolution.y;
			vec3 pos=position;
			vec3 dir=vec3((coord.x*xRot*ratio)+(coord.y*yRot)+(1.0*zRot));
			return castRay(pos,dir,100);
		}

		void main(){
			vec2 coord=gl_FragCoord.xy;
			vec2 uv=gl_FragCoord.xy/resolution;
			vec2 uv2=vec2(uv.x*2.-1.,uv.y*2.-1.);

			// highp uint idx=uint(coord.x)+(uint(coord.y)*uint(resolution.x));
			// highp uint value=getAtIdx(idx);
			// outColor=vec4(value,value,value,1);
			
			// vec2 value=getAtPos(coord.x,coord.y,255.);
			// outColor=vec4(value.xxx/1000.,1.);

			outColor=vec4(gammaCorrect(rayTrace(uv2)),1);
		}
	`;

	const programInfo = twgl.createProgramInfo(gl, [renderVs, renderFs]);

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
		bufferInfo
	};
}

function render(renderProgram,viewer) {
	twgl.resizeCanvasToDisplaySize(gl.canvas);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	let xRot=[1,0,0];
	let yRot=[0,1,0];
	let zRot=[0,0,1];

	xRot=rotateX(xRot,viewer.angle1);
	yRot=rotateX(yRot,viewer.angle1);
	zRot=rotateX(zRot,viewer.angle1);

	xRot=rotateY(xRot,viewer.angle2);
	yRot=rotateY(yRot,viewer.angle2);
	zRot=rotateY(zRot,viewer.angle2);

	const uniforms = {
		resolution: [gl.canvas.width,gl.canvas.height],

		voxResolution: [mapTextures.voxels.width,mapTextures.voxels.height],
		voxels: textures.voxels,
		lightResolution: [mapTextures.lightPing.width,mapTextures.lightPing.height],
		light: textures.lightSmoothPing,
		octResolution: [mapTextures.octree.width,mapTextures.octree.height],
		octree: textures.octree,

		xRot,
		yRot,
		zRot,
		position:viewer.position
	};

	gl.useProgram(renderProgram.programInfo.program);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	twgl.setBuffersAndAttributes(gl, renderProgram.programInfo, renderProgram.bufferInfo);
	twgl.setUniforms(renderProgram.programInfo, uniforms);
	twgl.drawBufferInfo(gl, renderProgram.bufferInfo);
}