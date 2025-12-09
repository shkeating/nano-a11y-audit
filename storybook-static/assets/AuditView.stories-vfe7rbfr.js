import{u as e}from"./jsxRuntime.module-D3_-wz5Q.js";import{P as h}from"./ProgressBar-CBr9fz0S.js";import{L as f}from"./LogConsole-B7245iDx.js";import"./iframe-Ba5BoSx3.js";import"./preload-helper-C1FmrZbK.js";function A({enableMultimodal:p,progress:o,logs:b}){return e("div",{id:"auditView",children:[p&&e("div",{className:"warning-box",children:[e("strong",{children:"IMPORTANT: Keep Window Focused"}),e("p",{style:{marginBottom:0,fontSize:"0.9em"},children:"Visual checks require the page to be visible on screen. Do not minimize."})]}),e("div",{className:"status-box",children:[e("h3",{children:"Audit Status"}),e(h,{current:o.current,total:o.total,label:"Progress"}),e("div",{className:"status-current-url",style:{marginBottom:"10px"},children:[e("strong",{children:"Current:"})," ",e("span",{children:o.currentUrl})]}),e(f,{logs:b})]})]})}const N={title:"Views/AuditView",component:A,tags:["autodocs"],argTypes:{enableMultimodal:{control:"boolean"},progress:{control:"object"},logs:{control:"object"}}},t={args:{enableMultimodal:!1,progress:{current:5,total:20,currentUrl:"https://example.com/about"},logs:["> Starting audit...","> Navigating to https://example.com/about","[Axe: image-alt] ❌ FAIL","[Nano: 1.4.1] ✅ PASS"]}},a={args:{...t.args,enableMultimodal:!0,logs:["> Multimodal analysis enabled.","> Please keep window focused.","> Analyzing screenshot..."]}},r={args:{enableMultimodal:!1,progress:{current:0,total:0,currentUrl:"Waiting to start..."},logs:[]}};var s,n,l;t.parameters={...t.parameters,docs:{...(s=t.parameters)==null?void 0:s.docs,source:{originalSource:`{
  args: {
    enableMultimodal: false,
    progress: {
      current: 5,
      total: 20,
      currentUrl: "https://example.com/about"
    },
    logs: ["> Starting audit...", "> Navigating to https://example.com/about", "[Axe: image-alt] ❌ FAIL", "[Nano: 1.4.1] ✅ PASS"]
  }
}`,...(l=(n=t.parameters)==null?void 0:n.docs)==null?void 0:l.source}}};var i,c,u;a.parameters={...a.parameters,docs:{...(i=a.parameters)==null?void 0:i.docs,source:{originalSource:`{
  args: {
    ...Default.args,
    enableMultimodal: true,
    logs: ["> Multimodal analysis enabled.", "> Please keep window focused.", "> Analyzing screenshot..."]
  }
}`,...(u=(c=a.parameters)==null?void 0:c.docs)==null?void 0:u.source}}};var d,m,g;r.parameters={...r.parameters,docs:{...(d=r.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    enableMultimodal: false,
    progress: {
      current: 0,
      total: 0,
      currentUrl: "Waiting to start..."
    },
    logs: []
  }
}`,...(g=(m=r.parameters)==null?void 0:m.docs)==null?void 0:g.source}}};const P=["Default","MultimodalEnabled","Empty"];export{t as Default,r as Empty,a as MultimodalEnabled,P as __namedExportsOrder,N as default};
