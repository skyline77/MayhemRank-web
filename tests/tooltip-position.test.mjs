import assert from 'node:assert/strict'
import {test} from 'node:test'
import {loadTS} from './load-ts.mjs'
const {tooltipPosition}=await loadTS('../src/tooltipPosition.ts')
function check(box,width,height,vw,vh){
 const result=tooltipPosition(box,width,height,vw,vh)
 const x=parseFloat(result.left),y=parseFloat(result.top),h=Math.min(height,parseFloat(result.maxHeight))
 assert.ok(x+width<=box.left || x>=box.right || y+h<=box.top || y>=box.bottom,'popup must not cover identity or stats')
 assert.ok(x>=8 && x+width<=vw-8 && y>=8 && y+h<=vh-8)
 return result
}
test('short tooltip fits above or below the full card',()=>{
 check({left:100,right:176,width:76,top:400,bottom:532},360,200,1280,800)
 check({left:100,right:176,width:76,top:20,bottom:152},360,200,1280,800)
})
test('tall desktop tooltip preserves alignment and scrolls outside statistics',()=>{
 const result=check({left:106,right:180,width:74,top:339,bottom:469},360,378,1280,720)
 assert.equal(result.left,'106px')
 assert.ok(parseFloat(result.maxHeight)<378)
 check({left:1100,right:1176,width:76,top:339,bottom:469},360,378,1280,720)
})
test('narrow screens constrain tooltip height outside the card',()=>{
 const result=check({left:100,right:176,width:76,top:339,bottom:469},344,600,360,720)
 assert.ok(parseFloat(result.maxHeight)<600)
})


test('left alignment flips at the main boundary, not the viewport boundary',()=>{
 const bounds={left:140,right:1140}
 const card={left:300,right:372,width:72,top:400,bottom:532}
 assert.equal(tooltipPosition(card,360,200,1280,800,bounds).left,'300px')
 const edge={...card,left:800,right:872}
 assert.equal(tooltipPosition(edge,360,200,1280,800,bounds).left,'512px')
 const exact={...card,left:780,right:852}
 assert.equal(tooltipPosition(exact,360,200,1280,800,bounds).left,'780px')
})

test('narrow main clamps flipped placement without overflowing either edge',()=>{
 const bounds={left:24,right:369}
 const card={left:160,right:232,width:72,top:400,bottom:532}
 assert.equal(tooltipPosition(card,345,200,393,852,bounds).left,'24px')
})


test('hero tooltips prefer below even when both sides fit; other tooltips retain their default',()=>{
 const card={left:300,right:372,width:72,top:300,bottom:432}
 assert.equal(tooltipPosition(card,360,200,1280,800,undefined,'below').top,'442px')
 assert.equal(tooltipPosition(card,360,200,1280,800).top,'90px')
 // Exact lower boundary still fits without covering the card or header.
 assert.equal(tooltipPosition(card,360,350,1280,800,undefined,'below').top,'442px')
})
test('hero tooltips flip above only when the space below cannot contain them',()=>{
 const card={left:800,right:872,width:72,top:550,bottom:682}
 const result=tooltipPosition(card,360,200,1280,800,{left:140,right:1140},'below')
 assert.equal(result.top,'340px');assert.equal(result.left,'512px')
})
test('when neither side fits, hero tooltips scroll in the larger available space',()=>{
 const upper={left:100,right:172,width:72,top:200,bottom:332}
 const below=tooltipPosition(upper,344,600,393,720,undefined,'below')
 assert.equal(below.top,'342px');assert.equal(below.maxHeight,'370px')
 const lower={...upper,top:400,bottom:532}
 const above=tooltipPosition(lower,344,600,393,720,undefined,'below')
 assert.equal(above.top,'8px');assert.equal(above.maxHeight,'382px')
})
