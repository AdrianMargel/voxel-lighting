
class Color{
	constructor(rOrC=0,g=0,b=0,a=1){
		if(typeof rOrC=="object"){
			this.r=rOrC.r;
			this.g=rOrC.g;
			this.b=rOrC.b;
			this.a=rOrC.a;
		}else if(isHex(rOrC)){
			let c=hexToRgb(rOrC);
			this.r=c.r/255;
			this.g=c.g/255;
			this.b=c.b/255;
			this.a=1;
		}else{
			this.r=rOrC;
			this.g=g;
			this.b=b;
			this.a=a;
		}
		this.limit();
	}
	limit(){
		function lim(c){
			return Math.max(Math.min(c,1),0);
		}
		this.r=lim(this.r);
		this.g=lim(this.g);
		this.b=lim(this.b);
		this.a=lim(this.a);
	}
	get R(){
		return Math.floor(this.r*255);
	}
	set R(v){
		this.r=v/255;
	}
	get G(){
		return Math.floor(this.g*255);
	}
	set G(v){
		this.g=v/255;
	}
	get B(){
		return Math.floor(this.b*255);
	}
	set B(v){
		this.b=v/255;
	}
	toString(){
		return rgbToHex(this.r*255,this.g*255,this.b*255,this.a*255);
	}
}

class Octree{
	constructor(size){
		this.size=size;
		this.children=Array(8).fill(null);
	}
	set(valOrF,x,y,z){
		let x1=Math.floor(x/this.size);
		let y1=Math.floor(y/this.size);
		let z1=Math.floor(z/this.size);

		let idx=x1+y1*2+z1*4;
		let next=this.children[idx];

		if(this.size==1){
			if(typeof valOrF=="function"){
				this.children[idx]=valOrF(next);
			}else{
				this.children[idx]=valOrF;
			}
			return;
		}

		if(next==null){
			next=new Octree(this.size/2);
			this.children[idx]=next;
		}

		let x2=x%this.size;
		let y2=y%this.size;
		let z2=z%this.size;
		return next.set(valOrF,x2,y2,z2);
	}
	get(x,y,z){
		let x1=Math.floor(x/this.size);
		let y1=Math.floor(y/this.size);
		let z1=Math.floor(z/this.size);

		let idx=x1+y1*2+z1*4;
		let next=this.children[idx];

		if(next==null)
			return this;
		if(this.size==1)
			return next;

		let x2=x%this.size;
		let y2=y%this.size;
		let z2=z%this.size;
		return next.get(x2,y2,z2);
	}
	toArray(arr=[]){
		this.index=arr.length;
		arr.push(...this.children);
		if(this.size>1){
			this.children.forEach(c=>{
				if(c!=null){
					c.toArray(arr);
				}
			});
		}
		this.children.forEach((c,i)=>{
			if(c!=null){
				arr[this.index+i]=c.index;
			}
		});
		return arr;
	}
	toUintArray(){
		return this.toArray().map(x=>(x??0));
		// return Array(600000).fill().map((x,i)=>(i%2)*500);
	}
}
class GameMap{
	constructor(){
		this.voxels=[];
		this.octree=null;
	}
	populate(){
		this.octree=new Octree(2**7);
		this.voxels=this.voxels.filter(v=>v.toOctree(this.octree));
	}
	boxArray(arr,components=1){
		let length=arr.length/components;

		let width=Math.ceil(Math.sqrt(length));
		let height=Math.ceil(length/width);
		let requiredLength=width*height*components;
		for(let i=arr.length;i<requiredLength;i++){
			arr.push(0);
		}
		return {
			arr,
			width,
			height
		};
	}
	toTextures(){
		let voxArr=[];
		let lightArr=[];
		this.voxels.forEach(v=>v.toArray(voxArr));
		this.voxels.forEach(v=>v.toLightArray(lightArr));
		
		let octArr=this.octree.toUintArray();
		
		let voxBox=this.boxArray(voxArr);
		let lightBox=this.boxArray(lightArr,4);
		let octBox=this.boxArray(octArr);

		return {
			voxels: {
				src: new Float32Array(voxBox.arr),
				width: voxBox.width,
				height: voxBox.height,
				minMag: gl.NEAREST,
				internalFormat: gl.R32F,
			},
			lightPing: {
				src: new Float32Array(lightBox.arr),
				width: lightBox.width,
				height: lightBox.height,
				minMag: gl.NEAREST,
				internalFormat: gl.RGBA32F,
			},
			lightPong: {
				src: new Float32Array(lightBox.arr),
				width: lightBox.width,
				height: lightBox.height,
				minMag: gl.NEAREST,
				internalFormat: gl.RGBA32F,
			},
			lightSmoothPing: {
				src: new Float32Array(lightBox.arr),
				width: lightBox.width,
				height: lightBox.height,
				minMag: gl.NEAREST,
				internalFormat: gl.RGBA32F,
			},
			lightSmoothPong: {
				src: new Float32Array(lightBox.arr),
				width: lightBox.width,
				height: lightBox.height,
				minMag: gl.NEAREST,
				internalFormat: gl.RGBA32F,
			},
			octree: {
				src: new Uint32Array(octBox.arr),
				width: octBox.width,
				height: octBox.height,
				minMag: gl.NEAREST,
				internalFormat: gl.R32UI,
			},
		};
	}
}
class Voxel{
	constructor(x,y,z, nx,ny,nz, r,g,b,a=1){
		this.pos=[x,y,z];
		this.index=0;

		if(nx==0&&ny==0&&nz==0){
			this.faces=[
				new Face(-1,0,0,r,g,b,a),
				new Face(1,0,0,r,g,b,a),
				new Face(0,-1,0,r,g,b,a),
				new Face(0,1,0,r,g,b,a),
				new Face(0,0,-1,r,g,b,a),
				new Face(0,0,1,r,g,b,a),
			];
		}else{
			this.faces=[
				new Face(nx,ny,nz,r,g,b,a),
				new Face(nx,ny,nz,r,g,b,a),
				new Face(nx,ny,nz,r,g,b,a),
				new Face(nx,ny,nz,r,g,b,a),
				new Face(nx,ny,nz,r,g,b,a),
				new Face(nx,ny,nz,r,g,b,a),
			];
		}
	}
	toOctree(oct){
		let open;
		oct.set((next)=>{
			open=next==null;
			return open?this:next;
		},...this.pos);
		return open;
	}
	toArray(arr=[]){
		let toAdd=[
			...this.pos,
			...this.faces.flatMap(f=>f.toArray())
		];
		this.index=arr.length/toAdd.length+1;
		arr.push(
			...toAdd
		);
		return arr;
	}
	toLightArray(arr=[]){
		arr.push(
			...new Array(4*this.faces.length).fill(0)//.map(x=>x*Math.random())
		);
		return arr;
	}
}
class Face{
	constructor(nx,ny,nz,r,g,b,a){
		// this.color=[Math.random(),Math.random(),Math.random()];
		this.color=[r/5,g/5,b/5];
		this.normal=[nx,ny,nz];
		this.opacity=a;
		this.gloss=0;
	}
	toArray(){
		return [
			...this.color,
			...this.normal,
			this.opacity,
			this.gloss
		]
	}
}

class Viewer{
	constructor(){
		this.position=[
			120+Math.random()*0.001,
			60+Math.random()*0.001,
			80+Math.random()*0.001
		];
		this.velocity=[
			0,
			0,
			0
		];
		this.angle1=-PI/5;
		this.angle2=0;

		this.speed=0.2;
		this.turnSpeed=0.003;
		this.friction=0.8;
	}
	run(ctrl){
		let mDiff=ctrl.getMouseMove();

		this.angle1=Math.min(Math.max(mDiff.y*this.turnSpeed+this.angle1,-PI/2),PI/2);
		this.angle2+=mDiff.x*this.turnSpeed;

		let xRot=[1,0,0];
		let yRot=[0,1,0];
		let zRot=[0,0,1];

		xRot=rotateX(xRot,this.angle1);
		yRot=rotateX(yRot,this.angle1);
		zRot=rotateX(zRot,this.angle1);

		xRot=rotateY(xRot,this.angle2);
		yRot=rotateY(yRot,this.angle2);
		zRot=rotateY(zRot,this.angle2);

		if(ctrl.isKeyDown("A")){
			this.velocity=vecAdd(this.velocity,vecScl(xRot,-this.speed));
		}
		if(ctrl.isKeyDown("D")){
			this.velocity=vecAdd(this.velocity,vecScl(xRot,this.speed));
		}
		if(ctrl.isKeyDown("W")){
			this.velocity=vecAdd(this.velocity,vecScl(zRot,this.speed));
		}
		if(ctrl.isKeyDown("S")){
			this.velocity=vecAdd(this.velocity,vecScl(zRot,-this.speed));
		}
		if(ctrl.isKeyDown(" ")){
			this.velocity=vecAdd(this.velocity,vecScl(yRot,this.speed));
		}
		if(ctrl.isKeyCodeDown(16)){
			this.velocity=vecAdd(this.velocity,vecScl(yRot,-this.speed));
		}
		this.position=vecAdd(this.position,this.velocity);
		this.velocity=vecScl(this.velocity,this.friction);
	}
}

const gameMap=new GameMap();

let control=new Control();
control.connect(document.getElementById("c"));

let viewer=new Viewer();

// for(let x=0;x<256;x+=10){
// 	for(let y=0;y<256;y+=10){
// 		for(let z=0;z<256;z+=10){
// 			let toAdd=new Voxel(
// 				x+Math.floor(Math.random()*10),
// 				y+Math.floor(Math.random()*10),
// 				z+Math.floor(Math.random()*10)
// 			);
// 			gameMap.voxels.push(toAdd);
// 		}
// 	}
// }
// for(let x=0;x<50;x+=2){
// 	for(let y=0;y<50;y+=2){
// 		let toAdd=new Voxel(
// 			x,
// 			y,
// 			40
// 		);
// 		gameMap.voxels.push(toAdd);
// 	}
// }
for(let i=0;i<00000;i++){
	// let p=[Math.random()*2-1,Math.random()*2-1,1];
	// let p=[Math.random(),Math.random(),1];
	// let mag=Math.sqrt(p.map(a=>a*a).reduce((a,b)=>a+b));
	// mag=Math.sqrt(mag);
	// p[0]/=mag;
	// p[1]/=mag;

	// mag=Math.sqrt(p.map(a=>a*a).reduce((a,b)=>a+b));
	// p=p.map(a=>a/mag);
	
	let a1=Math.sqrt(Math.random())*PI/2;
	if(Math.random()<0.5){
		a1=PI-a1;
	}
	let a2=Math.random()*TAU;
	let p=[1,0,0];
	p=rotateY(p,a1);
	p=rotateX(p,a2);
	let toAdd=new Voxel(
		Math.floor(p[0]*40+100),
		Math.floor(p[1]*40+100),
		Math.floor(p[2]*40+100),
		...(p.map(x=>-x)),
		0.85,0.85,0.85
	);
	// if(a2<2){
	// 	continue;
	// }
	if(p[0]>0.&&p[0]<0.6){
		continue;
	}
	gameMap.voxels.push(toAdd);
}
for(let i=0;i<00000;i++){
	// let p=[Math.random()*2-1,Math.random()*2-1,1];
	// let p=[Math.random(),Math.random(),1];
	// let mag=Math.sqrt(p.map(a=>a*a).reduce((a,b)=>a+b));
	// mag=Math.sqrt(mag);
	// p[0]/=mag;
	// p[1]/=mag;

	// mag=Math.sqrt(p.map(a=>a*a).reduce((a,b)=>a+b));
	// p=p.map(a=>a/mag);
	
	let a1=Math.sqrt(Math.random())*PI/2;
	if(Math.random()<0.5){
		a1=PI-a1;
	}
	let a2=Math.random()*TAU;
	let p=[1,0,0];
	p=rotateY(p,a1);
	p=rotateX(p,a2);
	let toAdd=new Voxel(
		Math.floor(p[0]*41+100),
		Math.floor(p[1]*41+100),
		Math.floor(p[2]*41+100),
		...p,
		0.85,0.85,0.85
	);
	// if(a2<2){
	// 	continue;
	// }
	if(p[0]>0.&&p[0]<0.6){
		continue;
	}
	gameMap.voxels.push(toAdd);
}
for(let i=0;i<-1000000;i++){
	
	let a1=Math.sqrt(Math.random())*PI/2;
	if(Math.random()<0.5){
		a1=PI-a1;
	}
	let a2=Math.random()*TAU;
	let p=[1,0,0];
	p=rotateY(p,a1);
	p=rotateX(p,a2);
	let toAdd=new Voxel(
		Math.floor(p[0]*50+130),
		Math.floor(p[1]*50+100),
		Math.floor(p[2]*50+130),
		...p,
		0.8,0.2,0.05,1
	);
	// if(a2>PI){
	// 	continue;
	// }
	if(p[1]<0.5){
		// continue;
	}
	gameMap.voxels.push(toAdd);
}
for(let i=0;i<100000;i++){
	
	let a1=Math.sqrt(Math.random())*PI/2;
	if(Math.random()<0.5){
		a1=PI-a1;
	}
	let a2=Math.random()*TAU;
	let p=[1,0,0];
	p=rotateY(p,a1);
	p=rotateX(p,a2);
	let scl=((
		Math.floor(p[0]*20/5+100)+
		Math.floor(p[1]*20/5+100)+
		Math.floor(p[2]*20/5+100)
	)/2%1+1)/2/5;
	let toAdd=new Voxel(
		Math.floor(p[0]*25+100),
		Math.floor(p[1]*25+100),
		Math.floor(p[2]*25+100),
		...p,
		// 0,0,0,
		// 0.95,0.95,0.95
		0.3*scl,0.7*scl,0.9*scl
	);
	// if(a2>PI){
	// 	continue;
	// }
	if(p[1]<0.5){
		// continue;
	}
	gameMap.voxels.push(toAdd);
}
for(let x=0;x<256;x++){
	for(let y=0;y<256;y++){
		for(let z=0;z<256;z++){
			// if(y<90&&((x<150&&z==0)||(z<150&&x==0))){
			// 	let toAdd=new Voxel(
			// 		x+20,y+20,z+20,
			// 		0,0,0,
			// 		0.55,0.51,0.71
			// 	);
			// 	gameMap.voxels.push(toAdd);
			// }
			
			// if(y==20){
			// 	let type=(
			// 		Math.floor(x/8)+
			// 		Math.floor(y/8)+
			// 		Math.floor(z/8)
			// 	)/2%1;
			// 	let toAdd=new Voxel(
			// 		x,y,z,
			// 		0,0,0,
			// 		...(type==0?[145,30,30]:[120,20,20]).map(x=>Math.pow(x/255,2.2))
			// 	);
			// 	gameMap.voxels.push(toAdd);
			// }
			// continue;
			
			if(x==100&&y>50&&y<70&&z<150&&z>50){
				let toAdd=new Voxel(
					x,y,z,
					0,0,0,
					0.95,0.95,0.95
				);
				gameMap.voxels.push(toAdd);
			}else if(x==150&&y>50&&y<70&&z<150&&z>50){
				let toAdd=new Voxel(
					x,y,z,
					0,0,0,
					0.95,0.95,0.95
				);
				gameMap.voxels.push(toAdd);
			}else if(y==50&&x>100&&x<150&&z<150&&z>50){
				let toAdd=new Voxel(
					x,y,z,
					0,0,0,
					0.95,0.95,0.95
				);
				gameMap.voxels.push(toAdd);
			// }else if(y==70&&x>100&&x<150&&z<150&&z>60){
			}else if(y==70&&x>100&&x<150&&z<145+20&&z>60-0){
				let toAdd=new Voxel(
					x,y,z,
					0,0,0,
					0.95,0.95,0.95
				);
				// if(z!=120&&x!=120&&z!=121&&x!=121)
				if(Math.abs(z-120)>2&&Math.abs(x-120)>2)
					gameMap.voxels.push(toAdd);
			}else if(y==90&&x>150&&x<160&&z<85&&z>60){
				let toAdd=new Voxel(
					x,y,z,
					0,0,0,
					0.95,0.95,0.95
				);
				// gameMap.voxels.push(toAdd);
			}else if(y>50&&y<60&&x>130&&x<140&&z<125&&z>100){
				let toAdd=new Voxel(
					x,y,z,
					0,0,0,
					0.3,0.7,0.9
				);
				gameMap.voxels.push(toAdd);
			}else if(z==150&&x>100-10&&x<150+10&&y>50&&y<90){
				let toAdd=new Voxel(
					x,y,z,
					0,0,0,
					0.3,0.7,0.9
				);
				gameMap.voxels.push(toAdd);
			}else if(z==50&&x>100-10&&x<150+10&&y>50&&y<90){
				let toAdd=new Voxel(
					x,y,z,
					0,0,0,
					0.8,0.3,0.1
				);
				gameMap.voxels.push(toAdd);
			}else if(y==20){
				// let toAdd=new Voxel(
				// 	x,y,z,
				// 	0,0,0,
				// 	0.25,0.75,0.1
				// );
				// gameMap.voxels.push(toAdd);
			}
			
		}
	}
}
gameMap.populate();

let mapTextures=gameMap.toTextures();
let textures=twgl.createTextures(gl,mapTextures);
let commonState={
	mapTextures,
	textures
};

let prog1=initRender();
let prog2=initLight();
let prog3=initSmoothLight();

let pingPong=true;

function display(time) {
	pingPong=!pingPong;
	light(prog2,pingPong);
	smoothLight(prog3,pingPong);
	render(prog1,viewer);
	requestAnimationFrame(display);
}
requestAnimationFrame(display);

document.getElementById("c").onclick = function() {
	document.getElementById("c").requestPointerLock();
}

setInterval(run,1000/60);
function run(){
	viewer.run(control);
	control.prime();
}