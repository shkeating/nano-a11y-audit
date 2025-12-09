import{u as e}from"./jsxRuntime.module-D3_-wz5Q.js";import{M as P}from"./Modal-B1YahRPS.js";import{B as c}from"./Button-CFmug2ML.js";import{C as o}from"./Checkbox-BalIrgHO.js";import{T as L}from"./TextArea-i0g0t4zq.js";import{k as w}from"./iframe-Ba5BoSx3.js";import"./Form.module-B8-Q64s3.js";import"./preload-helper-C1FmrZbK.js";function I({isOpen:S,onClose:l,onSave:k,settings:y,onUpdateSetting:t}){const{enableMultimodal:C,safeList:O,includePassed:x,includeNotPresent:T}=y;return e(P,{isOpen:S,onClose:l,title:"Settings",footer:e(w,{children:[e(c,{variant:"secondary",onClick:l,children:"Cancel"}),e(c,{onClick:k,children:"Save Changes"})]}),children:[e("fieldset",{children:[e("legend",{children:e("h4",{children:"Testing"})}),e(o,{label:"Enable Multimodal AI (Images)",checked:C,onChange:s=>t("enableMultimodal",s.target.checked),description:"Uncheck for faster, text-only audits."}),e("hr",{}),e(L,{label:"2.4.6 Heading & Labels Safe Terms (Comma Separated)",value:O.join(", "),onInput:s=>t("safeList",s.target.value.split(",").map(v=>v.trim())),description:"Add your organization's specific acronyms or internal terms here to prevent false positives.",rows:6})]}),e("fieldset",{children:[e("legend",{children:e("h4",{children:"Reporting"})}),e(o,{label:"Include 'Passed' results",checked:x,onChange:s=>t("includePassed",s.target.checked)}),e(o,{label:"Include 'Not Present' results",checked:T,onChange:s=>t("includeNotPresent",s.target.checked)})]})]})}const H={title:"Views/SettingsModal",component:I,tags:["autodocs"],argTypes:{isOpen:{control:"boolean"},onClose:{action:"closed"},onSave:{action:"saved"},onUpdateSetting:{action:"setting updated"},settings:{control:"object"}}},i={enableMultimodal:!0,safeList:["email","password","search"],includePassed:!1,includeNotPresent:!1},a={args:{isOpen:!0,settings:i}},n={args:{isOpen:!0,settings:{...i,enableMultimodal:!1}}},r={args:{isOpen:!0,settings:{...i,safeList:["email","password","search","address","city","state","zip","phone","fax","dob","ssn","credit card"]}}};var d,u,m;a.parameters={...a.parameters,docs:{...(d=a.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    isOpen: true,
    settings: defaultSettings
  }
}`,...(m=(u=a.parameters)==null?void 0:u.docs)==null?void 0:m.source}}};var p,g,f;n.parameters={...n.parameters,docs:{...(p=n.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    isOpen: true,
    settings: {
      ...defaultSettings,
      enableMultimodal: false
    }
  }
}`,...(f=(g=n.parameters)==null?void 0:g.docs)==null?void 0:f.source}}};var h,b,M;r.parameters={...r.parameters,docs:{...(h=r.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    isOpen: true,
    settings: {
      ...defaultSettings,
      safeList: ["email", "password", "search", "address", "city", "state", "zip", "phone", "fax", "dob", "ssn", "credit card"]
    }
  }
}`,...(M=(b=r.parameters)==null?void 0:b.docs)==null?void 0:M.source}}};const R=["Default","TextOnlyMode","WithManySafeTerms"];export{a as Default,n as TextOnlyMode,r as WithManySafeTerms,R as __namedExportsOrder,H as default};
