import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, interpolate} from 'remotion';
import {Video} from '@remotion/media';

const fps=30;
const fade=(f:number,a=0,b=12,c=72,d=90)=>interpolate(f,[a,b,c,d],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
const Still=({src,scale=1}:{src:string;scale?:number})=>{const f=useCurrentFrame();const z=interpolate(f,[0,120],[scale,scale+0.025],{extrapolateRight:'clamp'});return <AbsoluteFill style={{overflow:'hidden'}}><Img src={staticFile(src)} style={{width:'100%',height:'100%',objectFit:'cover',transform:`scale(${z})`}}/></AbsoluteFill>};
const Clip=({src,start=0,end}:{src:string;start?:number;end?:number})=><AbsoluteFill><Video src={staticFile(src)} startFrom={Math.round(start*fps)} endAt={end?Math.round(end*fps):undefined} volume={0}/></AbsoluteFill>;
const CenterText=({children,size=70}:{children:React.ReactNode;size?:number})=>{const f=useCurrentFrame();return <AbsoluteFill style={{justifyContent:'center',alignItems:'center',background:'linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.48))'}}><div style={{opacity:fade(f,0,10,68,82),transform:`translateY(${interpolate(f,[0,14],[18,0],{extrapolateRight:'clamp'})}px)`,color:'#fff',fontFamily:'Inter,Arial,sans-serif',fontWeight:750,fontSize:size,letterSpacing:4,textAlign:'center',maxWidth:1450,lineHeight:1.12,textShadow:'0 4px 30px rgba(0,0,0,.85)'}}>{children}</div></AbsoluteFill>};
const PressureWords=()=>{const f=useCurrentFrame();const words=[['CLIENT',0,270,245],['DEADLINE',10,1310,250],['TEAM',20,300,520],['MONEY',30,1340,520],['FAMILY',40,360,790],['YOURSELF',52,1270,790]] as const;return <AbsoluteFill style={{background:'radial-gradient(circle at center, transparent 25%, rgba(0,0,0,.35) 100%)'}}>{words.map(([w,s,x,y])=>{const o=interpolate(f,[s,s+7],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return <div key={w} style={{position:'absolute',left:x,top:y,transform:'translate(-50%,-50%)',opacity:o,color:'#fff',fontFamily:'Inter,Arial,sans-serif',fontWeight:800,fontSize:w==='YOURSELF'?48:42,letterSpacing:6,textShadow:'0 3px 18px #000'}}>{w}</div>})}</AbsoluteFill>};
const Placeholder=()=> <AbsoluteFill style={{backgroundColor:'#050505',justifyContent:'center',alignItems:'center'}}><div style={{color:'#fff',fontFamily:'Inter,Arial',fontSize:52,fontWeight:700,textAlign:'center'}}>REAL iMESSAGE / PHOTON PROOF<br/><span style={{fontSize:26,fontWeight:400,opacity:.58}}>Reserved for the genuine iPhone capture</span></div></AbsoluteFill>;
export const Film:React.FC=()=> <AbsoluteFill style={{backgroundColor:'#000'}}>
  {/* ACT 1 — THE WEIGHT / 0:00–0:25 */}
  <Sequence from={0} durationInFrames={210}><Clip src="clips/01-boardroom-pullback.mp4" start={0} end={7}/></Sequence>
  <Sequence from={210} durationInFrames={105}><Still src="images/pressure.png"/><PressureWords/></Sequence>
  <Sequence from={315} durationInFrames={105}><Still src="images/isolation.png"/></Sequence>
  <Sequence from={420} durationInFrames={90}><Still src="images/isolation.png"/><CenterText size={56}>EVERYONE EXPECTS YOU<br/>TO HAVE THE ANSWER.</CenterText></Sequence>
  <Sequence from={510} durationInFrames={90}><Still src="images/isolation.png"/><CenterText size={72}>WHO DOES THE CEO ASK?</CenterText></Sequence>
  <Sequence from={600} durationInFrames={75}><Still src="images/reach-phone.png"/></Sequence>
  <Sequence from={675} durationInFrames={75}><Still src="images/type-phone.png"/></Sequence>

  {/* ACT 2 — THE BOARD / 0:25–0:46 */}
  <Sequence from={750} durationInFrames={150}><Clip src="clips/02-cfo-reveal.mp4" start={3.2} end={8.2}/></Sequence>
  <Sequence from={900} durationInFrames={150}><Clip src="clips/03-operator-reveal.mp4" start={3.4} end={8.4}/></Sequence>
  <Sequence from={1050} durationInFrames={75}><Still src="images/watch-storyboard.png"/></Sequence>
  <Sequence from={1125} durationInFrames={165}><Clip src="clips/04-future-you-reveal.mp4" start={3.0} end={8.5}/></Sequence>
  <Sequence from={1290} durationInFrames={90}><Still src="images/full-board.png"/></Sequence>

  {/* ACT 3 — genuine product proof */}
  <Sequence from={1380} durationInFrames={600}><Placeholder/></Sequence>

  {/* ACT 4 — PAYOFF */}
  <Sequence from={1980} durationInFrames={180}><Still src="images/full-board.png"/><CenterText size={54}>GOOD DECISIONS DESERVE<br/>FOLLOW-THROUGH.</CenterText></Sequence>
  <Sequence from={2160} durationInFrames={240}><AbsoluteFill style={{backgroundColor:'#050505',justifyContent:'center',alignItems:'center'}}><div style={{color:'#fff',fontFamily:'Inter,Arial,sans-serif',textAlign:'center'}}><div style={{fontSize:96,fontWeight:800,letterSpacing:-2}}>CEO Me</div><div style={{fontSize:40,marginTop:20}}>Your personal board of directors in iMessage.</div><div style={{fontSize:28,marginTop:24,opacity:.58}}>Built with Photon.</div></div></AbsoluteFill></Sequence>
</AbsoluteFill>;
