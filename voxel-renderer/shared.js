let faceDataLength=8;
let voxDataLength=3;
let totalVoxDataLength=voxDataLength+faceDataLength*6;

let commonVariables=glsl`

uniform vec2 voxResolution;
uniform highp sampler2D voxels;

uniform vec2 lightResolution;
uniform sampler2D light;

uniform vec2 octResolution;
uniform highp usampler2D octree;
`;

let commonFunctions=glsl`

//https://www.shadertoy.com/view/4djSRW
vec3 hash33(vec3 p3){
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
	p3 += dot(p3, p3.yxz+33.33);
	return fract((p3.xxy + p3.yxx)*p3.zyx);
}
//  1 out, 3 in...
float hash13(vec3 p3)
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}
// vec3 crossProduct(vec3 a,vec3 b){
// 	return vec3(
// 		a.y*b.z-a.z*b.y,
// 		a.z*b.x-a.x*b.z,
// 		a.x*b.y-a.y*b.x
// 	);
// }

vec3 gammaCorrect(vec3 col){
	float gammaExp=1./2.2;
	return vec3(pow(col.x,gammaExp),pow(col.y,gammaExp),pow(col.z,gammaExp));
}
vec3 gammaShift(vec3 col){
	float gammaExp=2.2;
	return vec3(pow(col.x,gammaExp),pow(col.y,gammaExp),pow(col.z,gammaExp));
}

highp uint getOctAtIdx(highp uint idx){
	uint width=uint(octResolution.x);
	vec2 halfPix=vec2(0.5,0.5);

	uint y=idx/width;
	uint x=idx-(y*width);

	vec2 idxPos=vec2(x,y);
	//make sure to sample from the center of the pixel
	idxPos+=halfPix;
	if(idxPos.y>=octResolution.y){
		return uint(0);
	}
	return texture(octree, idxPos/octResolution).r;
}
float getVoxAtIdx(highp uint voxIdx,uint dataIdx){
	uint width=uint(voxResolution.x);
	vec2 halfPix=vec2(0.5,0.5);

	highp uint idx=voxIdx*uint(${totalVoxDataLength})+dataIdx;

	uint y=idx/width;
	uint x=idx-(y*width);

	vec2 idxPos=vec2(x,y);
	//make sure to sample from the center of the pixel
	idxPos+=halfPix;
	if(idxPos.y>=voxResolution.y){
		return 0.;
	}
	return texture(voxels, idxPos/voxResolution).r;
}
float getFaceAtIdx(highp uint voxIdx,uint faceIdx,uint dataIdx){
	uint width=uint(voxResolution.x);
	vec2 halfPix=vec2(0.5,0.5);

	highp uint idx=faceIdx*uint(${faceDataLength})+uint(${voxDataLength})+dataIdx;

	return getVoxAtIdx(voxIdx,idx);
}
vec3 getLightAtIdx(highp uint idx){
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
	return texture(light, idxPos/lightResolution).rgb;
}

highp uvec2 getAtPos(float x,float y,float z){
	float size=256.;

	if(x>=size||y>=size||z>=size||x<0.||y<0.||z<0.){
		return uvec2(size,0);
	}

	float x1;
	float y1;
	float z1;
	float x2=x;
	float y2=y;
	float z2=z;
	highp uint next=uint(0);

	for(int i=0;i<8;i++){
		size/=2.0;

		x1=floor(x2/size);
		y1=floor(y2/size);
		z1=floor(z2/size);
		
		next=getOctAtIdx(next+uint(x1+y1*2.+z1*4.));
		if(next==uint(0)||size==1.){
			return uvec2(uint(size),next);
		}

		x2=floor(mod(x2,size));
		y2=floor(mod(y2,size));
		z2=floor(mod(z2,size));
	}

	//should never be reached
	return uvec2(0,0);
}

vec3 castRay(vec3 pos,vec3 dir,int maxSteps){
	dir*=1./length(dir);
	highp uvec2 cube=getAtPos(floor(pos.x),floor(pos.y),floor(pos.z));
	float size=float(cube.x);

	vec3 col=vec3(0.,0.,0.);
	float remaining=1.;
	float small=0.001;

	for(int i=0;i<maxSteps;i++){
		float next=1000.;
		float nextTry;
		vec3 moveDim=vec3(0.,0.,0.);
		vec3 modPos=vec3(
			size-mod(pos.x*sign(dir.x),size),
			size-mod(pos.y*sign(dir.y),size),
			size-mod(pos.z*sign(dir.z),size)
		);
		if(modPos.x>0.){
			nextTry=abs(modPos.x/dir.x);
			if(nextTry<next){
				moveDim=vec3(small*sign(dir.x),0.,0.);
				next=nextTry;
			}
		}
		if(modPos.y>0.){
			nextTry=abs(modPos.y/dir.y);
			if(nextTry<next){
				moveDim=vec3(0.,small*sign(dir.y),0.);
				next=nextTry;
			}
		}
		if(modPos.z>0.){
			nextTry=abs(modPos.z/dir.z);
			if(nextTry<next){
				moveDim=vec3(0.,0.,small*sign(dir.z));
				next=nextTry;
			}
		}
		pos+=dir*next;

		if(moveDim.x!=0.){
			pos.x=round(pos.x);
		}else if(moveDim.y!=0.){
			pos.y=round(pos.y);
		}else if(moveDim.z!=0.){
			pos.z=round(pos.z);
		}

		if(
			(dir.x>0.&&pos.x>=256.)
			||(dir.x<0.&&pos.x<=0.)
			||(dir.y>0.&&pos.y>=256.)
			||(dir.y<0.&&pos.y<=0.)
			||(dir.z>0.&&pos.z>=256.)
			||(dir.z<0.&&pos.z<=0.)
		){
			float margin=4.0;
			float margin2=256.-margin;
			if(
				(
					  (pos.x>=0.&&pos.x<=256.)
					&&(pos.y>=0.&&pos.y<=256.)
					&&(pos.z>=0.&&pos.z<=256.)
				)
				&&
				(
					  (pos.x<margin&&pos.y<margin)
					||(pos.x>margin2&&pos.y>margin2)
					||(pos.x<margin&&pos.y>margin2)
					||(pos.x>margin2&&pos.y<margin)
					||
					  (pos.z<margin&&pos.y<margin)
					||(pos.z>margin2&&pos.y>margin2)
					||(pos.z<margin&&pos.y>margin2)
					||(pos.z>margin2&&pos.y<margin)
					||
					  (pos.x<margin&&pos.z<margin)
					||(pos.x>margin2&&pos.z>margin2)
					||(pos.x<margin&&pos.z>margin2)
					||(pos.x>margin2&&pos.z<margin)
				)
			){
				float lineDiff;
				if((pos.x<=0.||pos.x>=256.)){
					lineDiff=max(
						max(256.-pos.z,pos.z),
						max(256.-pos.y,pos.y)
					);
				}else if((pos.y<=0.||pos.y>=256.)){
					lineDiff=max(
						max(256.-pos.x,pos.x),
						max(256.-pos.z,pos.z)
					);
				}else if((pos.z<=0.||pos.z>=256.)){
					lineDiff=max(
						max(256.-pos.x,pos.x),
						max(256.-pos.y,pos.y)
					);
				}
				lineDiff=(lineDiff-256.+margin)/margin;
				return col+vec3(lineDiff,lineDiff,lineDiff)*remaining;
			}
			if(pos.y>=256.){
				return vec3(0.3,.6,1.)*1.;
			}
			// if(pos.z>=256.&&pos.x>150.&&pos.y>200.){
			// 	return vec3(1.,.8,.2)*150.;
			// 	// return vec3(0.5,0.8,1.)*5.;
			// }else if(pos.y>=256.){
			// 	return vec3(.2,.9,.9);
			// 	// return vec3(0.1,0.4,0.2)*5.;
			// }else if(pos.y<0.){
			// 	return vec3(.2,.2,.2);
			// }

			// return col+vec3(float(i)/50.,float(i)/50.,float(i)/50.)*remaining;
			// return col;
			// return vec3(1.,1.,1.);
			// return vec3(length(position-pos)/256.,length(position-pos)/300.,length(position-pos)/456.);
		}

		vec3 toTest=pos+moveDim;
		toTest=floor(toTest);
		cube=getAtPos(toTest.x,toTest.y,toTest.z);
		size=float(cube.x);
		if(cube.y>uint(0)){

			//voxel indexes must start at 1 to avoid being mistaken for blank slots which have a value of 0
			highp uint voxIdx=cube.y-uint(1);

			uint faceIdx;
			//+X,-X,+Y,-Y,+Z,-Z
			if(moveDim.x>0.){
				faceIdx=uint(0);
			}else if(moveDim.x<0.){
				faceIdx=uint(1);
			}else if(moveDim.y>0.){
				faceIdx=uint(2);
			}else if(moveDim.y<0.){
				faceIdx=uint(3);
			}else if(moveDim.z>0.){
				faceIdx=uint(4);
			}else if(moveDim.z<0.){
				faceIdx=uint(5);
			}
			float opacity=getFaceAtIdx(voxIdx,faceIdx,uint(6));
			
			// col+=vec3(
			// 	getVoxAtIdx(cube.y+uint(0)+faceIdx)*getVoxAtIdx(cube.y+uint(3)+faceIdx),
			// 	getVoxAtIdx(cube.y+uint(1)+faceIdx)*getVoxAtIdx(cube.y+uint(4)+faceIdx),
			// 	getVoxAtIdx(cube.y+uint(2)+faceIdx)*getVoxAtIdx(cube.y+uint(5)+faceIdx)
			// )*remaining*opacity;
			vec3 light=getLightAtIdx(voxIdx*uint(6)+uint(faceIdx));
			col+=vec3(
				getFaceAtIdx(voxIdx,faceIdx,uint(0)),
				getFaceAtIdx(voxIdx,faceIdx,uint(1)),
				getFaceAtIdx(voxIdx,faceIdx,uint(2))
			)*light*remaining*opacity;
			
			remaining*=1.-opacity;

			if(remaining<0.01){
				return col;
			}
		}
	}

	return col;
}
`;

const gl = document.getElementById("c").getContext("webgl2");
gl.getExtension('EXT_color_buffer_float');