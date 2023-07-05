import{Version as s}from"./version.js";let i=0;class o{constructor(){i++,this.version=new s,this.version.globalId=i}increment(){this.version.revision++}}export{o as VersionedObject};
