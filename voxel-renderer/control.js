
class Control{
	constructor(){
		this.pressedKeys={};
		this.mousePosReal=new Vector();
		this.mouseMovement=new Vector();
		this.mouseDown=false;
		this.mouseRDown=false;
		this.mouseLDown=false;
		this.touchMode=false;

		this.mouseWheel=0;

		this.rightClickTime=0;
	}
	connect(element){
		window.onkeyup = (e)=>{
			this.pressedKeys[e.keyCode] = false;
			if(e.keyCode==16||e.keyCode==32){
				e.preventDefault();
			}
		}
		window.onkeydown = (e)=>{
			this.pressedKeys[e.keyCode] = true;
			if(e.keyCode==16||e.keyCode==32){
				e.preventDefault();
			}
		}

		element.onwheel = (e)=>{this.mouseWheel+=Math.sign(e.deltaY)};

		let clickFunc=(e)=>{
			this.touchMode=false;
			if (e.button===0) {
				this.mouseLDown=true;
			}
			if (e.button===2) {
				if(this.rightClickTime!=e.timeStamp){
					//The oncontextmenu event can fire on mouse up.
					//to avoid treating it as a key process the first event if two occur at the same time
					this.mouseRDown=true;
					this.rightClickTime=e.timeStamp;
				}
			}
			this.mouseDown=this.mouseRDown||this.mouseLDown;
			e.preventDefault();
		};
		element.onmousedown = clickFunc;
		element.oncontextmenu = clickFunc;
		document.body.onmouseup = (e)=>{
			this.touchMode=false;
			if (e.button===0) {
				this.mouseLDown=false;
			}
			if (e.button===2) {
				this.mouseRDown=false;
				this.rightClickTime=e.timeStamp;
			}
			this.mouseDown=this.mouseRDown||this.mouseLDown;
		}
		element.onmousemove = (e)=>{this.trackMouse(e)};

		element.ontouchstart = (e)=>{this.tStart(e)};
		element.ontouchmove = (e)=>{this.tMove(e)};
		document.body.ontouchend = (e)=>{this.tEnd(e)};
	}
	prime(){
		this.mouseWheel=0;
		this.mouseMovement=new Vector();
	}
	tStart(e){
		if(e.changedTouches.length>0){
			this.mousePosReal=new Vector(e.changedTouches[0].clientX,e.changedTouches[0].clientY);
		}
		this.mouseDown=true;
		if(!this.touchMode){
			openFullScreen();
			this.touchMode=true;
		}
	}
	tMove(e){
		if(e.changedTouches.length>0){
			this.mousePosReal=new Vector(e.changedTouches[0].clientX,e.changedTouches[0].clientY);
		}
		this.mouseDown=true;
		if(!this.touchMode){
			openFullScreen();
			this.touchMode=true;
		}
	}
	tEnd(e){
		this.mouseDown=false;
		if(!this.touchMode){
			openFullScreen();
			this.touchMode=true;
		}
	}
	trackMouse(e){
		this.mouseMovement.addVec(new Vector(e.movementX,e.movementY));
		this.mousePosReal=new Vector(e.offsetX,e.offsetY);
	}
	getMouse(cam){
		let mPos=new Vector(this.mousePosReal);
		mPos.sclVec(1/cam.zoom);
		mPos.addVec(cam.pos);
		return mPos;
	}
	getMouseMove(){
		return new Vector(this.mouseMovement);
	}
	isKeyDown(key){
		return !!this.pressedKeys[key.charCodeAt(0)];
	}
	isKeyCodeDown(keycode){
		return !!this.pressedKeys[16];
	}
	isMouseDown(){
		return this.mouseDown;
	}
}