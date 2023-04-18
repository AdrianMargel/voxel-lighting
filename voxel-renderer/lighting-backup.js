function initLight(){
	let lightVs=glsl`#version 300 es

	in float idx;

	${commonVariables}

	out vec3 col1;
	out vec3 col2;
	out vec3 col3;
	out vec3 col4;
	out vec3 col5;
	out vec3 col6;

	${commonFunctions}

	void main(){
		col1=vec3(1.,idx,1.);
		col2=vec3(2.,2.,2.);
		col3=vec3(3.,3.,3.);
		col4=vec3(4.,4.,4.);
		col5=vec3(5.,5.,5.);
		col6=vec3(6.,6.,6.);
	}
	`;

	let lightFs=glsl`#version 300 es
	precision highp float;
	void main(){}
	`;

	const inputArrays = {
		idx:{
			numComponents: 1,
			data:[
				1,2,3
			],
		},
	};
	const outputArrays = {
		col1: {
			numComponents: 3,
			data:new Float32Array(3*3*6)
		},
		col2: {
			numComponents: 3,
			data:new Float32Array(0)
		},
		col3: {
			numComponents: 3,
			data:new Float32Array(0)
		},
		col4: {
			numComponents: 3,
			data:new Float32Array(0)
		},
		col5: {
			numComponents: 3,
			data:new Float32Array(0)
		},
		col6: {
			numComponents: 3,
			data:new Float32Array(0)
		},
	};

	const inputBufferInfo=twgl.createBufferInfoFromArrays(gl, inputArrays);
	const outputBufferInfo=twgl.createBufferInfoFromArrays(gl, outputArrays);

	const programInfo=twgl.createProgramInfo(gl, [lightVs, lightFs], {
		transformFeedbackVaryings: outputBufferInfo,
		transformFeedbackMode: gl.INTERLEAVED_ATTRIBS //gl.SEPARATE_ATTRIBS
	});
	const transformFeedback=twgl.createTransformFeedback(gl, programInfo, outputBufferInfo);

	return {
		programInfo,
		inputBufferInfo,
		outputBufferInfo,
		transformFeedback
	};
}

let lightProgram=initLight();

function light() {
	const uniforms = {
		voxResolution: [mapTextures.voxels.width,mapTextures.voxels.height],
		voxels: textures.voxels,
		octResolution: [mapTextures.octree.width,mapTextures.octree.height],
		octree: textures.octree
	};

	gl.useProgram(lightProgram.programInfo.program);
	twgl.setBuffersAndAttributes(gl, lightProgram.programInfo, lightProgram.inputBufferInfo);
	twgl.setUniforms(lightProgram.programInfo, uniforms);

	gl.enable(gl.RASTERIZER_DISCARD);
	gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,lightProgram.transformFeedback);
	gl.beginTransformFeedback(gl.POINTS);

	twgl.drawBufferInfo(gl,lightProgram.inputBufferInfo,gl.POINTS);
	
	gl.endTransformFeedback();
	gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);
    gl.disable(gl.RASTERIZER_DISCARD);

	const results = new Float32Array(3*3*6);
	gl.bindBuffer(gl.ARRAY_BUFFER,lightProgram.outputBufferInfo.attribs.col1.buffer);
	gl.getBufferSubData(
		gl.ARRAY_BUFFER,
		0,
		results,
	);
	console.log(...results);
}