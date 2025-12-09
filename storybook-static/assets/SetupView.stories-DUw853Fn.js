import{u as e}from"./jsxRuntime.module-D3_-wz5Q.js";import{B as a}from"./Button-CFmug2ML.js";import{F as g}from"./FileInput-t4Jiz2EU.js";import"./iframe-Ba5BoSx3.js";import"./preload-helper-C1FmrZbK.js";import"./Form.module-B8-Q64s3.js";function h({onFileUpload:p,onOpenSettings:u,onStartAudit:m,urlCount:o}){return e("div",{id:"setup",children:[e("h3",{children:"Getting Started"}),e("p",{className:"instruction-text",children:"Upload a CSV of URLs to begin the hybrid audit."}),e("div",{className:"flex",children:e("section",{style:{width:"100%"},children:[e("h3",{children:"Test Sample"}),e(g,{label:"Load URLs (CSV):",accept:".csv",onChange:p,helperContent:o>0&&e("small",{style:{color:"green",display:"block",marginTop:"5px"},children:["✅ ",o," URLs loaded ready for testing."]})})]})}),e("div",{className:"grid",style:{marginTop:"20px"},children:[e(a,{variant:"secondary",outline:!0,onClick:u,children:"Configure Settings"}),e(a,{onClick:m,children:"Start Batch Audit"})]})]})}const V={title:"Views/SetupView",component:h,tags:["autodocs"],argTypes:{onFileUpload:{action:"file uploaded"},onOpenSettings:{action:"open settings"},onStartAudit:{action:"start audit"},urlCount:{control:"number"}}},t={args:{urlCount:0}},r={args:{urlCount:15}};var n,i,s;t.parameters={...t.parameters,docs:{...(n=t.parameters)==null?void 0:n.docs,source:{originalSource:`{
  args: {
    urlCount: 0
  }
}`,...(s=(i=t.parameters)==null?void 0:i.docs)==null?void 0:s.source}}};var l,c,d;r.parameters={...r.parameters,docs:{...(l=r.parameters)==null?void 0:l.docs,source:{originalSource:`{
  args: {
    urlCount: 15
  }
}`,...(d=(c=r.parameters)==null?void 0:c.docs)==null?void 0:d.source}}};const b=["Default","FileLoaded"];export{t as Default,r as FileLoaded,b as __namedExportsOrder,V as default};
