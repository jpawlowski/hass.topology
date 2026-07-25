var Et=Object.defineProperty;var At=Object.getOwnPropertyDescriptor;var l=(i,r,e,t)=>{for(var o=t>1?void 0:t?At(r,e):r,n=i.length-1,a;n>=0;n--)(a=i[n])&&(o=(t?a(r,e,o):a(o))||o);return t&&o&&Et(r,e,o),o};var de=globalThis,pe=de.ShadowRoot&&(de.ShadyCSS===void 0||de.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Ee=Symbol(),ze=new WeakMap,te=class{constructor(r,e,t){if(this._$cssResult$=!0,t!==Ee)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=r,this.t=e}get styleSheet(){let r=this.o,e=this.t;if(pe&&r===void 0){let t=e!==void 0&&e.length===1;t&&(r=ze.get(e)),r===void 0&&((this.o=r=new CSSStyleSheet).replaceSync(this.cssText),t&&ze.set(e,r))}return r}toString(){return this.cssText}},We=i=>new te(typeof i=="string"?i:i+"",void 0,Ee),x=(i,...r)=>{let e=i.length===1?i[0]:r.reduce((t,o,n)=>t+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(o)+i[n+1],i[0]);return new te(e,i,Ee)},De=(i,r)=>{if(pe)i.adoptedStyleSheets=r.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let e of r){let t=document.createElement("style"),o=de.litNonce;o!==void 0&&t.setAttribute("nonce",o),t.textContent=e.cssText,i.appendChild(t)}},Ae=pe?i=>i:i=>i instanceof CSSStyleSheet?(r=>{let e="";for(let t of r.cssRules)e+=t.cssText;return We(e)})(i):i;var{is:kt,defineProperty:Ot,getOwnPropertyDescriptor:Ct,getOwnPropertyNames:Pt,getOwnPropertySymbols:Lt,getPrototypeOf:Tt}=Object,ue=globalThis,Be=ue.trustedTypes,It=Be?Be.emptyScript:"",Ht=ue.reactiveElementPolyfillSupport,re=(i,r)=>i,oe={toAttribute(i,r){switch(r){case Boolean:i=i?It:null;break;case Object:case Array:i=i==null?i:JSON.stringify(i)}return i},fromAttribute(i,r){let e=i;switch(r){case Boolean:e=i!==null;break;case Number:e=i===null?null:Number(i);break;case Object:case Array:try{e=JSON.parse(i)}catch{e=null}}return e}},he=(i,r)=>!kt(i,r),Ve={attribute:!0,type:String,converter:oe,reflect:!1,useDefault:!1,hasChanged:he};Symbol.metadata??=Symbol("metadata"),ue.litPropertyMetadata??=new WeakMap;var U=class extends HTMLElement{static addInitializer(r){this._$Ei(),(this.l??=[]).push(r)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(r,e=Ve){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(r)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(r,e),!e.noAccessor){let t=Symbol(),o=this.getPropertyDescriptor(r,t,e);o!==void 0&&Ot(this.prototype,r,o)}}static getPropertyDescriptor(r,e,t){let{get:o,set:n}=Ct(this.prototype,r)??{get(){return this[e]},set(a){this[e]=a}};return{get:o,set(a){let u=o?.call(this);n?.call(this,a),this.requestUpdate(r,u,t)},configurable:!0,enumerable:!0}}static getPropertyOptions(r){return this.elementProperties.get(r)??Ve}static _$Ei(){if(this.hasOwnProperty(re("elementProperties")))return;let r=Tt(this);r.finalize(),r.l!==void 0&&(this.l=[...r.l]),this.elementProperties=new Map(r.elementProperties)}static finalize(){if(this.hasOwnProperty(re("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(re("properties"))){let e=this.properties,t=[...Pt(e),...Lt(e)];for(let o of t)this.createProperty(o,e[o])}let r=this[Symbol.metadata];if(r!==null){let e=litPropertyMetadata.get(r);if(e!==void 0)for(let[t,o]of e)this.elementProperties.set(t,o)}this._$Eh=new Map;for(let[e,t]of this.elementProperties){let o=this._$Eu(e,t);o!==void 0&&this._$Eh.set(o,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(r){let e=[];if(Array.isArray(r)){let t=new Set(r.flat(1/0).reverse());for(let o of t)e.unshift(Ae(o))}else r!==void 0&&e.push(Ae(r));return e}static _$Eu(r,e){let t=e.attribute;return t===!1?void 0:typeof t=="string"?t:typeof r=="string"?r.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(r=>this.enableUpdating=r),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(r=>r(this))}addController(r){(this._$EO??=new Set).add(r),this.renderRoot!==void 0&&this.isConnected&&r.hostConnected?.()}removeController(r){this._$EO?.delete(r)}_$E_(){let r=new Map,e=this.constructor.elementProperties;for(let t of e.keys())this.hasOwnProperty(t)&&(r.set(t,this[t]),delete this[t]);r.size>0&&(this._$Ep=r)}createRenderRoot(){let r=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return De(r,this.constructor.elementStyles),r}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(r=>r.hostConnected?.())}enableUpdating(r){}disconnectedCallback(){this._$EO?.forEach(r=>r.hostDisconnected?.())}attributeChangedCallback(r,e,t){this._$AK(r,t)}_$ET(r,e){let t=this.constructor.elementProperties.get(r),o=this.constructor._$Eu(r,t);if(o!==void 0&&t.reflect===!0){let n=(t.converter?.toAttribute!==void 0?t.converter:oe).toAttribute(e,t.type);this._$Em=r,n==null?this.removeAttribute(o):this.setAttribute(o,n),this._$Em=null}}_$AK(r,e){let t=this.constructor,o=t._$Eh.get(r);if(o!==void 0&&this._$Em!==o){let n=t.getPropertyOptions(o),a=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:oe;this._$Em=o;let u=a.fromAttribute(e,n.type);this[o]=u??this._$Ej?.get(o)??u,this._$Em=null}}requestUpdate(r,e,t,o=!1,n){if(r!==void 0){let a=this.constructor;if(o===!1&&(n=this[r]),t??=a.getPropertyOptions(r),!((t.hasChanged??he)(n,e)||t.useDefault&&t.reflect&&n===this._$Ej?.get(r)&&!this.hasAttribute(a._$Eu(r,t))))return;this.C(r,e,t)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(r,e,{useDefault:t,reflect:o,wrapped:n},a){t&&!(this._$Ej??=new Map).has(r)&&(this._$Ej.set(r,a??e??this[r]),n!==!0||a!==void 0)||(this._$AL.has(r)||(this.hasUpdated||t||(e=void 0),this._$AL.set(r,e)),o===!0&&this._$Em!==r&&(this._$Eq??=new Set).add(r))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let r=this.scheduleUpdate();return r!=null&&await r,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[o,n]of this._$Ep)this[o]=n;this._$Ep=void 0}let t=this.constructor.elementProperties;if(t.size>0)for(let[o,n]of t){let{wrapped:a}=n,u=this[o];a!==!0||this._$AL.has(o)||u===void 0||this.C(o,void 0,n,u)}}let r=!1,e=this._$AL;try{r=this.shouldUpdate(e),r?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(t){throw r=!1,this._$EM(),t}r&&this._$AE(e)}willUpdate(r){}_$AE(r){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(r)),this.updated(r)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(r){return!0}update(r){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(r){}firstUpdated(r){}};U.elementStyles=[],U.shadowRootOptions={mode:"open"},U[re("elementProperties")]=new Map,U[re("finalized")]=new Map,Ht?.({ReactiveElement:U}),(ue.reactiveElementVersions??=[]).push("2.1.2");var Oe=globalThis,Fe=i=>i,me=Oe.trustedTypes,Ge=me?me.createPolicy("lit-html",{createHTML:i=>i}):void 0,Ce="$lit$",j=`lit$${Math.random().toFixed(9).slice(2)}$`,Pe="?"+j,Mt=`<${Pe}>`,G=document,ne=()=>G.createComment(""),se=i=>i===null||typeof i!="object"&&typeof i!="function",Le=Array.isArray,Qe=i=>Le(i)||typeof i?.[Symbol.iterator]=="function",ke=`[ 	
\f\r]`,ie=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,qe=/-->/g,Ke=/>/g,V=RegExp(`>|${ke}(?:([^\\s"'>=/]+)(${ke}*=${ke}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Ye=/'/g,Xe=/"/g,Ze=/^(?:script|style|textarea|title)$/i,Te=i=>(r,...e)=>({_$litType$:i,strings:r,values:e}),c=Te(1),Y=Te(2),vr=Te(3),P=Symbol.for("lit-noChange"),h=Symbol.for("lit-nothing"),Je=new WeakMap,F=G.createTreeWalker(G,129);function et(i,r){if(!Le(i)||!i.hasOwnProperty("raw"))throw Error("invalid template strings array");return Ge!==void 0?Ge.createHTML(r):r}var tt=(i,r)=>{let e=i.length-1,t=[],o,n=r===2?"<svg>":r===3?"<math>":"",a=ie;for(let u=0;u<e;u++){let d=i[u],f,$,m=-1,v=0;for(;v<d.length&&(a.lastIndex=v,$=a.exec(d),$!==null);)v=a.lastIndex,a===ie?$[1]==="!--"?a=qe:$[1]!==void 0?a=Ke:$[2]!==void 0?(Ze.test($[2])&&(o=RegExp("</"+$[2],"g")),a=V):$[3]!==void 0&&(a=V):a===V?$[0]===">"?(a=o??ie,m=-1):$[1]===void 0?m=-2:(m=a.lastIndex-$[2].length,f=$[1],a=$[3]===void 0?V:$[3]==='"'?Xe:Ye):a===Xe||a===Ye?a=V:a===qe||a===Ke?a=ie:(a=V,o=void 0);let E=a===V&&i[u+1].startsWith("/>")?" ":"";n+=a===ie?d+Mt:m>=0?(t.push(f),d.slice(0,m)+Ce+d.slice(m)+j+E):d+j+(m===-2?u:E)}return[et(i,n+(i[e]||"<?>")+(r===2?"</svg>":r===3?"</math>":"")),t]},ae=class i{constructor({strings:r,_$litType$:e},t){let o;this.parts=[];let n=0,a=0,u=r.length-1,d=this.parts,[f,$]=tt(r,e);if(this.el=i.createElement(f,t),F.currentNode=this.el.content,e===2||e===3){let m=this.el.content.firstChild;m.replaceWith(...m.childNodes)}for(;(o=F.nextNode())!==null&&d.length<u;){if(o.nodeType===1){if(o.hasAttributes())for(let m of o.getAttributeNames())if(m.endsWith(Ce)){let v=$[a++],E=o.getAttribute(m).split(j),I=/([.?@])?(.*)/.exec(v);d.push({type:1,index:n,name:I[2],strings:E,ctor:I[1]==="."?ge:I[1]==="?"?ve:I[1]==="@"?be:K}),o.removeAttribute(m)}else m.startsWith(j)&&(d.push({type:6,index:n}),o.removeAttribute(m));if(Ze.test(o.tagName)){let m=o.textContent.split(j),v=m.length-1;if(v>0){o.textContent=me?me.emptyScript:"";for(let E=0;E<v;E++)o.append(m[E],ne()),F.nextNode(),d.push({type:2,index:++n});o.append(m[v],ne())}}}else if(o.nodeType===8)if(o.data===Pe)d.push({type:2,index:n});else{let m=-1;for(;(m=o.data.indexOf(j,m+1))!==-1;)d.push({type:7,index:n}),m+=j.length-1}n++}}static createElement(r,e){let t=G.createElement("template");return t.innerHTML=r,t}};function q(i,r,e=i,t){if(r===P)return r;let o=t!==void 0?e._$Co?.[t]:e._$Cl,n=se(r)?void 0:r._$litDirective$;return o?.constructor!==n&&(o?._$AO?.(!1),n===void 0?o=void 0:(o=new n(i),o._$AT(i,e,t)),t!==void 0?(e._$Co??=[])[t]=o:e._$Cl=o),o!==void 0&&(r=q(i,o._$AS(i,r.values),o,t)),r}var fe=class{constructor(r,e){this._$AV=[],this._$AN=void 0,this._$AD=r,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(r){let{el:{content:e},parts:t}=this._$AD,o=(r?.creationScope??G).importNode(e,!0);F.currentNode=o;let n=F.nextNode(),a=0,u=0,d=t[0];for(;d!==void 0;){if(a===d.index){let f;d.type===2?f=new J(n,n.nextSibling,this,r):d.type===1?f=new d.ctor(n,d.name,d.strings,this,r):d.type===6&&(f=new ye(n,this,r)),this._$AV.push(f),d=t[++u]}a!==d?.index&&(n=F.nextNode(),a++)}return F.currentNode=G,o}p(r){let e=0;for(let t of this._$AV)t!==void 0&&(t.strings!==void 0?(t._$AI(r,t,e),e+=t.strings.length-2):t._$AI(r[e])),e++}},J=class i{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(r,e,t,o){this.type=2,this._$AH=h,this._$AN=void 0,this._$AA=r,this._$AB=e,this._$AM=t,this.options=o,this._$Cv=o?.isConnected??!0}get parentNode(){let r=this._$AA.parentNode,e=this._$AM;return e!==void 0&&r?.nodeType===11&&(r=e.parentNode),r}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(r,e=this){r=q(this,r,e),se(r)?r===h||r==null||r===""?(this._$AH!==h&&this._$AR(),this._$AH=h):r!==this._$AH&&r!==P&&this._(r):r._$litType$!==void 0?this.$(r):r.nodeType!==void 0?this.T(r):Qe(r)?this.k(r):this._(r)}O(r){return this._$AA.parentNode.insertBefore(r,this._$AB)}T(r){this._$AH!==r&&(this._$AR(),this._$AH=this.O(r))}_(r){this._$AH!==h&&se(this._$AH)?this._$AA.nextSibling.data=r:this.T(G.createTextNode(r)),this._$AH=r}$(r){let{values:e,_$litType$:t}=r,o=typeof t=="number"?this._$AC(r):(t.el===void 0&&(t.el=ae.createElement(et(t.h,t.h[0]),this.options)),t);if(this._$AH?._$AD===o)this._$AH.p(e);else{let n=new fe(o,this),a=n.u(this.options);n.p(e),this.T(a),this._$AH=n}}_$AC(r){let e=Je.get(r.strings);return e===void 0&&Je.set(r.strings,e=new ae(r)),e}k(r){Le(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,t,o=0;for(let n of r)o===e.length?e.push(t=new i(this.O(ne()),this.O(ne()),this,this.options)):t=e[o],t._$AI(n),o++;o<e.length&&(this._$AR(t&&t._$AB.nextSibling,o),e.length=o)}_$AR(r=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);r!==this._$AB;){let t=Fe(r).nextSibling;Fe(r).remove(),r=t}}setConnected(r){this._$AM===void 0&&(this._$Cv=r,this._$AP?.(r))}},K=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(r,e,t,o,n){this.type=1,this._$AH=h,this._$AN=void 0,this.element=r,this.name=e,this._$AM=o,this.options=n,t.length>2||t[0]!==""||t[1]!==""?(this._$AH=Array(t.length-1).fill(new String),this.strings=t):this._$AH=h}_$AI(r,e=this,t,o){let n=this.strings,a=!1;if(n===void 0)r=q(this,r,e,0),a=!se(r)||r!==this._$AH&&r!==P,a&&(this._$AH=r);else{let u=r,d,f;for(r=n[0],d=0;d<n.length-1;d++)f=q(this,u[t+d],e,d),f===P&&(f=this._$AH[d]),a||=!se(f)||f!==this._$AH[d],f===h?r=h:r!==h&&(r+=(f??"")+n[d+1]),this._$AH[d]=f}a&&!o&&this.j(r)}j(r){r===h?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,r??"")}},ge=class extends K{constructor(){super(...arguments),this.type=3}j(r){this.element[this.name]=r===h?void 0:r}},ve=class extends K{constructor(){super(...arguments),this.type=4}j(r){this.element.toggleAttribute(this.name,!!r&&r!==h)}},be=class extends K{constructor(r,e,t,o,n){super(r,e,t,o,n),this.type=5}_$AI(r,e=this){if((r=q(this,r,e,0)??h)===P)return;let t=this._$AH,o=r===h&&t!==h||r.capture!==t.capture||r.once!==t.once||r.passive!==t.passive,n=r!==h&&(t===h||o);o&&this.element.removeEventListener(this.name,this,t),n&&this.element.addEventListener(this.name,this,r),this._$AH=r}handleEvent(r){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,r):this._$AH.handleEvent(r)}},ye=class{constructor(r,e,t){this.element=r,this.type=6,this._$AN=void 0,this._$AM=e,this.options=t}get _$AU(){return this._$AM._$AU}_$AI(r){q(this,r)}},rt={M:Ce,P:j,A:Pe,C:1,L:tt,R:fe,D:Qe,V:q,I:J,H:K,N:ve,U:be,B:ge,F:ye},Rt=Oe.litHtmlPolyfillSupport;Rt?.(ae,J),(Oe.litHtmlVersions??=[]).push("3.3.3");var ot=(i,r,e)=>{let t=e?.renderBefore??r,o=t._$litPart$;if(o===void 0){let n=e?.renderBefore??null;t._$litPart$=o=new J(r.insertBefore(ne(),n),n,void 0,e??{})}return o._$AI(i),o};var Ie=globalThis,y=class extends U{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let r=super.createRenderRoot();return this.renderOptions.renderBefore??=r.firstChild,r}update(r){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(r),this._$Do=ot(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return P}};y._$litElement$=!0,y.finalized=!0,Ie.litElementHydrateSupport?.({LitElement:y});var Nt=Ie.litElementPolyfillSupport;Nt?.({LitElement:y});(Ie.litElementVersions??=[]).push("4.2.2");var S=i=>(r,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(i,r)}):customElements.define(i,r)};var Ut={attribute:!0,type:String,converter:oe,reflect:!1,hasChanged:he},jt=(i=Ut,r,e)=>{let{kind:t,metadata:o}=e,n=globalThis.litPropertyMetadata.get(o);if(n===void 0&&globalThis.litPropertyMetadata.set(o,n=new Map),t==="setter"&&((i=Object.create(i)).wrapped=!0),n.set(e.name,i),t==="accessor"){let{name:a}=e;return{set(u){let d=r.get.call(this);r.set.call(this,u),this.requestUpdate(a,d,i,!0,u)},init(u){return u!==void 0&&this.C(a,void 0,i,u),u}}}if(t==="setter"){let{name:a}=e;return function(u){let d=this[a];r.call(this,u),this.requestUpdate(a,d,i,!0,u)}}throw Error("Unsupported decorator location: "+t)};function p(i){return(r,e)=>typeof e=="object"?jt(i,r,e):((t,o,n)=>{let a=o.hasOwnProperty(n);return o.constructor.createProperty(n,t),a?Object.getOwnPropertyDescriptor(o,n):void 0})(i,r,e)}function b(i){return p({...i,state:!0,attribute:!1})}var g=class extends Error{constructor(r,e){super(e),this.name="TopologyError",this.code=r}};function zt(i){if(i&&typeof i=="object"&&"code"in i){let r=i;return new g(r.code,r.message??r.code)}return new g("store_error",i instanceof Error?i.message:String(i))}var xe=class{constructor(r){this.connection=r}async send(r){try{return await this.connection.sendMessagePromise(r)}catch(e){throw zt(e)}}listAnnotations(){return this.send({type:"topology/list_annotations"})}health(){return this.send({type:"topology/health"})}neighbors(r){return this.send({type:"topology/neighbors",area_id:r})}path(r,e,t=!1){return this.send({type:"topology/path",from:r,to:e,traversable_only:t})}subscribeUpdates(r){return this.connection.subscribeMessage(r,{type:"topology/subscribe_updates"})}updateArea(r,e){return this.send({type:"topology/update_area",area_id:r,annotation:e})}upsertEdge(r,e,t){return this.send({type:"topology/upsert_edge",area_a:r,area_b:e,connections:t})}deleteEdge(r){return this.send({type:"topology/delete_edge",edge_id:r})}restoreEdge(r){return this.send({type:"topology/restore_edge",edge_id:r})}setBeyond(r,e,t){return this.send({type:"topology/set_beyond",area_id:r,side:e,beyond:t})}setExteriorConnections(r,e){return this.send({type:"topology/set_exterior_connections",area_id:r,connections:e})}setFloorLevel(r,e){return this.send({type:"topology/set_floor_level",floor_id:r,level:e})}updateHomeConfig(r){return this.send({type:"topology/update_home_config",...r})}};var _e=class{constructor(r,e={}){this.listeners=new Set;this._state={snapshot:null,health:null,connected:!0,error:null};this.unsubscribe=null;this.coalesceTimer=null;this.disposed=!1;this.client=r,this.coalesceMs=e.coalesceMs??150}get state(){return this._state}addListener(r){return this.listeners.add(r),()=>this.listeners.delete(r)}setState(r){this._state={...this._state,...r};for(let e of this.listeners)e()}async connect(){await this.reseed(),!this.disposed&&(this.unsubscribe=await this.client.subscribeUpdates(r=>this.handleUpdate(r)))}async reseed(){try{let[r,e]=await Promise.all([this.client.listAnnotations(),this.client.health()]);this.setState({snapshot:r,health:e,error:null})}catch(r){this.setState({error:r instanceof Error?r.message:String(r)})}}handleUpdate(r){this.coalesceTimer!==null&&clearTimeout(this.coalesceTimer),this.coalesceTimer=setTimeout(()=>{this.coalesceTimer=null,this.reseed()},this.coalesceMs)}handleConnectionState(r){let e=this._state.connected;this.setState({connected:r}),r&&!e&&this.reseed()}async dispose(){if(this.disposed=!0,this.coalesceTimer!==null&&(clearTimeout(this.coalesceTimer),this.coalesceTimer=null),this.unsubscribe!==null){let r=this.unsubscribe;this.unsubscribe=null,await r()}this.listeners.clear()}};var Wt=["unannotated","isolated","floors","bearings","exterior","geometry","orphans"],Dt={unannotated:"map",isolated:"map",floors:"floors",bearings:"map",exterior:"map",geometry:"map",orphans:"orphans"};function it(i){return i===null?"":`?focus=${i}`}function Bt(i){return i!==null&&Wt.includes(i)}function nt(i){let r=i.startsWith("?")?i.slice(1):i,t=new URLSearchParams(r).get("focus");return Bt(t)?{view:Dt[t],focus:t}:{view:"map",focus:null}}var Q={"panel.title":"Topology","panel.floor.outdoor":"Outdoor / unfloored","panel.floor.all":"All floors","panel.floor.switcher":"Floor","panel.nav.home":"Home configuration","panel.nav.floors":"Floor levels","panel.nav.orphans":"Orphaned entries","panel.nav.back":"Back to home configuration","banner.reconnecting":"Reconnecting\u2026","banner.error":"Could not load topology data","map.needs_annotation":"Needs annotation","map.orphaned":"Orphaned (registry entry gone)","map.legend.trust":"Trust","map.legend.environment":"Environment","map.hint":"Drag to pan, scroll to zoom, double-click to reset.","map.reset_view":"Reset view","map.empty":"No areas to show. Create areas in Home Assistant first.","map.band.unfloored":"No floor","map.offfloor":"{count} connection(s) lead to another floor \u2014 switch to All floors to see them.","sidebar.unannotated":"Unannotated areas","sidebar.isolated":"Isolated areas","sidebar.bearings":"Contradictory bearings","sidebar.spanning":"Connections spanning several floors","sidebar.no_climb":"Connections between floors with no way to climb","sidebar.none":"Nothing flagged","editor.area.title":"Area annotation","editor.area.type":"Type","editor.area.type.hint":"A shortcut, not a setting: picking a type fills in Environment and Trust below, which are the values automations actually read. Change them freely afterwards \u2014 and leave Type empty if none fits.","editor.area.type.custom":"Custom type\u2026","editor.area.type.custom_label":"Custom type","editor.area.environment":"Environment","editor.area.environment.hint":"Whether this space is enclosed, open to the weather, or in between.","editor.area.trust":"Trust","editor.area.trust.hint":"How exposed the space is to people: private (household only), shared (guests, other tenants), public (anyone). A boundary where this changes becomes part of the perimeter.","editor.area.unsaved":"Unsaved changes","editor.edge.title":"Connection","editor.edge.preset":"Kind","editor.edge.add":"Add connection","editor.edge.delete":"Delete connection","editor.edge.between":"{a} \u2194 {b}","editor.edge.axis.horizontal":"Same floor","editor.edge.axis.vertical_up":"{b} is {levels} floor(s) above {a}","editor.edge.axis.vertical_down":"{b} is {levels} floor(s) below {a}","editor.edge.axis.unknown":"Floor relationship unknown (assign both areas to a floor)","editor.edge.hint":"A boundary can carry several ways across \u2014 a stair and a lift beside it are two entries here.","editor.neighbors.title":"Neighbours","editor.neighbors.hint":"Which areas this one physically borders. This is what makes the adjacency graph \u2014 automations use it to reason about rooms next to, above, and below each other.","editor.neighbors.none":"No neighbours declared yet","editor.neighbors.add":"Add neighbour","editor.neighbors.area":"Area","editor.neighbors.pick":"Choose an area\u2026","editor.neighbors.group.same":"Same floor","editor.neighbors.group.above":"Floor above","editor.neighbors.group.below":"Floor below","editor.neighbors.group.distant":"Other floors (unusual)","editor.neighbors.group.unknown":"No floor assigned","editor.neighbors.distant_warning":"These areas are more than one floor apart, so they rarely share a boundary. Check the floor assignments if that is unexpected.","editor.neighbors.edit":"Edit","editor.beyond.title":"Outer walls","editor.beyond.hint":"For each side that is NOT shared with another one of your areas, say what is on the other side. This is what makes a wall count as exterior, and it decides where a window can sit.","editor.beyond.interior":"Interior wall \u2014 borders {areas}","editor.beyond.unset":"Not specified","editor.beyond.suggest":"Set to {value}, based on your occupancy extent","editor.exterior.title":"Windows & outside doors","editor.exterior.hint":"Openings that leave your home entirely. Set the side each one faces \u2014 without it the opening cannot be matched against the outer wall it sits in, so nothing can use it.","editor.exterior.none":"No windows or outside doors declared","editor.exterior.sideless":"An opening without a side cannot be matched to the outer wall it sits in, so nothing will use it. Pick a side for each one.","editor.exterior.outer_sides":"Outer walls declared for this area: {sides}.","editor.exterior.beyond_trust":"Trust beyond","editor.exterior.beyond_trust.hint":"Who can reach the far side. Left empty it counts as public, which makes the opening part of the perimeter.","editor.connection.side":"Side","editor.connection.side.hint":"Rough compass bearing of the wall this sits in.","editor.connection.glazed":"Glazed (lets daylight through)","editor.connection.sensor":"Open/close sensor","editor.connection.sensor.hint":"Bind a binary sensor to make this opening observable. Only bound openings can turn the perimeter sensor on.","editor.connection.sensor.none":"Not bound","editor.connection.sensor.unavailable":"Only a door-type kind can carry a sensor","editor.connection.override":"Always treat as perimeter","editor.connection.override.hint":"Force this boundary into the perimeter even when both sides share the same trust class \u2014 for example the door between a main flat and an annexe.","editor.floor.title":"Floor levels","editor.floor.hint":"Levels come from Home Assistant and only say what sits above what \u2014 0 is a perfectly normal ground floor. Topology can fill in a level for a floor that has none; a level set in Home Assistant always wins.","editor.floor.effective":"Effective level","editor.floor.override":"Override","editor.floor.from_registry":"From Home Assistant","editor.floor.unset":"No level set","editor.home.title":"Home configuration","editor.home.occupancy":"Occupancy extent","editor.home.occupancy.hint":"Whether you model a whole property or one unit inside a larger building. Recorded for consumers; it does not change any derivation.","editor.home.threshold":"Unannotated repair threshold","editor.home.threshold.hint":"Raise a repair notice once at least this many areas are still unannotated.","editor.home.projection":"Label projection","editor.home.projection.hint":"Mirror annotations onto Home Assistant areas as `topology:<dimension>:<value>` labels so automations can target them directly.","editor.home.project_environment":"Project environment labels","editor.home.project_type":"Project type labels","editor.home.project_trust":"Project trust labels","first_run.title":"Seed annotations from Home Assistant","first_run.hint":"One-shot import from the area registry. It only fills in annotations that are still empty and never overwrites what you have set.","first_run.source.aliases":"Import area aliases","first_run.source.labels":"Import area labels","first_run.import":"Import","first_run.running":"Importing\u2026","first_run.dismiss":"Not now","editor.orphans.title":"Orphaned entries","editor.orphans.restore":"Restore","editor.orphans.empty":"No orphaned entries","action.save":"Save","action.cancel":"Cancel","action.clear":"Clear","action.add":"Add","action.remove":"Remove","action.close":"Close","enum.environment.indoor":"Indoor","enum.environment.outdoor":"Outdoor","enum.environment.semi_outdoor":"Semi-outdoor","enum.trust.private":"Private","enum.trust.shared":"Shared","enum.trust.public":"Public","enum.beyond.outdoor":"Open air","enum.beyond.neighbor":"Neighbouring unit","enum.beyond.earth":"Earth (buried)","enum.side.N":"North","enum.side.E":"East","enum.side.S":"South","enum.side.W":"West","enum.passage.none":"No way through","enum.passage.level":"Step-free","enum.passage.stairs":"Stairs","enum.passage.ramp":"Ramp","enum.passage.elevator":"Lift","enum.passage.ladder":"Ladder","enum.passage.hatch":"Hatch","enum.barrier.open":"Open","enum.barrier.door":"Door","enum.barrier.solid":"Solid","enum.preset.interior_door":"Interior door","enum.preset.open_passage":"Open passage","enum.preset.shared_wall":"Shared wall","enum.preset.open_stair":"Open stair","enum.preset.enclosed_stair":"Enclosed stair","enum.preset.lift":"Lift","enum.preset.loft_ladder":"Loft ladder","enum.preset.ramp":"Ramp","enum.preset.hatch":"Hatch","enum.preset.window":"Window","enum.preset.outside_door":"Outside door","enum.occupancy.whole_property":"Whole property","enum.occupancy.unit_within_building":"Unit within a building","enum.type.bedroom":"Bedroom","enum.type.living":"Living room","enum.type.kitchen":"Kitchen","enum.type.dining":"Dining room","enum.type.bathroom":"Bathroom","enum.type.hallway":"Hallway","enum.type.office":"Office","enum.type.utility":"Utility room","enum.type.storage":"Storage","enum.type.garage":"Garage","enum.type.balcony":"Balcony","enum.type.terrace":"Terrace","enum.type.outdoor":"Outdoors","error.not_loaded":"Topology is not loaded","error.area_not_found":"Area not found","error.edge_not_found":"Edge not found","error.floor_not_found":"Floor not found","error.invalid_enum":"Invalid value","error.invalid_connection":"Invalid connection","error.store_error":"Could not save the change","error.unauthorized":"Admin permission required"};var st={en:Q};function s(i,r={},e="en"){let o=(st[e]??Q)[i]??Q[i]??i;for(let[n,a]of Object.entries(r))o=o.replace(`{${n}}`,String(a));return o}function _(i,r,e="en"){let t=`enum.${i}.${r}`;return(st[e]??Q)[t]??Q[t]??r}var Vt={nodeWidth:150,nodeHeight:64,gapX:32,rowGap:24,bandGap:56,padding:40,maxColumns:5};function at(i,r){if(i.length===0)return[];let e=Math.min(i.length,Math.max(1,r)),t=[];for(let o=0;o<i.length;o+=e)t.push(i.slice(o,o+e));return t}function He(i,r=[],e={}){let t={...Vt,...e},o=new Map,n=[];if(i.length===0)return{positions:o,bands:n,extent:{x:0,y:0,width:t.nodeWidth,height:t.nodeHeight}};let a=new Map;for(let E of i){let I=E.floorId,ee=a.get(I);ee===void 0?a.set(I,[E]):ee.push(E)}let u=[];for(let E of r)a.has(E)&&u.push(E);for(let E of a.keys())u.includes(E)||u.push(E);let d=1;for(let E of u)for(let I of at(a.get(E)??[],t.maxColumns))d=Math.max(d,I.length);let f=d*t.nodeWidth+(d-1)*t.gapX,$=t.padding+f/2,m=t.padding;for(let E of u){let I=at(a.get(E)??[],t.maxColumns),ee=m;for(let Se of I){let wt=Se.length*t.nodeWidth+(Se.length-1)*t.gapX,je=$-wt/2;for(let St of Se)o.set(St.areaId,{x:je+t.nodeWidth/2,y:m+t.nodeHeight/2}),je+=t.nodeWidth+t.gapX;m+=t.nodeHeight+t.rowGap}m=m-t.rowGap+t.bandGap,n.push({floorId:E,y:ee,height:m-t.bandGap-ee})}let v=m-t.bandGap+t.padding;return{positions:o,bands:n,extent:{x:0,y:0,width:f+2*t.padding,height:v}}}function lt(i){return i??"unknown"}function ct(i){return i??"unknown"}function dt(i){return i.type===null&&i.environment===null&&i.trust===null}var Ft={open:2,door:1,solid:0},Gt={none:"",level:"",stairs:"stairs",ramp:"ramp",elevator:"elevator",ladder:"ladder",hatch:"hatch"};function qt(i){let r=null,e=-1;for(let t of i){let o=Ft[t.barrier]??0;o>e&&(e=o,r=t)}return r}function pt(i){let r=qt(i.connections);return r===null?{barrier:"solid",passage:"none",glyph:"",perimeter:i.is_perimeter}:{barrier:r.barrier,passage:r.passage,glyph:Gt[r.passage]??"",perimeter:i.is_perimeter}}var ce="__outdoor__",Kt={unannotated:"unannotated_areas",isolated:"isolated_areas",floors:"indoor_areas_without_floor",bearings:"contradictory_bearings",exterior:"exterior_on_non_outdoor_side"},Z=150,le=64,Yt=.4,Xt=4,O=class extends y{constructor(){super(...arguments);this.areas=[];this.edges=[];this.floors=[];this.health=null;this.activeFloor=null;this.focusScope=null;this.selectedAreaId=null;this.selectedEdgeId=null;this.viewOverride=null;this.panStart=null;this.onWheel=e=>{e.preventDefault();let t=this.currentView(),o=this.contentExtent(),n=e.deltaY>0?1.15:1/1.15,a=t.width*n;if(o.width/a<Yt||o.width/a>Xt)return;let u=t.height*n,{x:d,y:f}=this.toSvgPoint(e,t);this.viewOverride={x:d-(d-t.x)*a/t.width,y:f-(f-t.y)*u/t.height,width:a,height:u}};this.onPointerDown=e=>{if(e.target.closest(".node, .edge")!==null)return;let t=this.currentView();this.panStart={pointerId:e.pointerId,x:e.clientX,y:e.clientY,view:t},e.currentTarget.setPointerCapture(e.pointerId)};this.onPointerMove=e=>{let t=this.panStart;if(t===null||t.pointerId!==e.pointerId)return;let n=e.currentTarget.getBoundingClientRect(),a=Math.min(n.width/t.view.width,n.height/t.view.height)||1;this.viewOverride={...t.view,x:t.view.x-(e.clientX-t.x)/a,y:t.view.y-(e.clientY-t.y)/a}};this.onPointerUp=e=>{this.panStart?.pointerId===e.pointerId&&(this.panStart=null)};this.resetView=()=>{this.viewOverride=null}}areaFloor(e){return this.hass?.areas?.[e]?.floor_id??ce}areaName(e,t){let o=this.hass?.areas?.[e]?.name;return o||(t.type??e)}floorName(e){return e===null||e===ce?s("panel.floor.outdoor"):this.hass?.floors?.[e]?.name??e}flaggedEdges(){return this.focusScope!=="geometry"||this.health===null?new Set:new Set([...this.health.edges_spanning_multiple_floors??[],...this.health.vertical_edges_without_vertical_passage??[]])}flaggedAreas(){if(this.focusScope===null||this.health===null)return new Set;let e=Kt[this.focusScope];if(e===void 0)return new Set;let t=this.health[e];return new Set(Array.isArray(t)?t:[])}visibleAreas(){return this.activeFloor===null?this.areas:this.areas.filter(e=>this.areaFloor(e.area_id)===this.activeFloor)}floorOrder(){return[...this.floors.map(e=>e.floor_id),ce]}render(){let e=this.visibleAreas();if(e.length===0)return c`<div class="empty">${s("map.empty")}</div>`;let t=new Set(e.map(v=>v.area_id)),o=e.map(v=>({areaId:v.area_id,floorId:this.areaFloor(v.area_id)})),n=He(o,this.floorOrder(),{nodeWidth:Z,nodeHeight:le}),a=this.flaggedAreas(),u=this.flaggedEdges(),d=this.edges.filter(v=>!v.orphaned_at&&t.has(v.area_a)&&t.has(v.area_b)),f=this.edges.filter(v=>!v.orphaned_at&&t.has(v.area_a)!==t.has(v.area_b)).length,$=this.viewOverride??n.extent,m=`${$.x} ${$.y} ${$.width} ${$.height}`;return c`
      <div class="wrap">
        <svg
          viewBox=${m}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          @wheel=${this.onWheel}
          @pointerdown=${this.onPointerDown}
          @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp}
          @pointercancel=${this.onPointerUp}
          @dblclick=${this.resetView}
        >
          <g class="bands">
            ${n.bands.length>1?n.bands.map(v=>this.renderBand(v,n.extent)):h}
          </g>
          <g class="edges">
            ${d.map(v=>this.renderEdge(v,n.positions,u.has(v.edge_id)))}
          </g>
          <g class="nodes">
            ${e.map(v=>this.renderNode(v,n.positions,a.has(v.area_id)))}
          </g>
        </svg>
        ${this.renderLegend()}
        <div class="overlay">
          ${this.viewOverride!==null?c`<button class="reset" @click=${this.resetView}>${s("map.reset_view")}</button>`:h}
          ${f>0?c`<p class="offfloor">${s("map.offfloor",{count:f})}</p>`:h}
          <p class="hint">${s("map.hint")}</p>
        </div>
      </div>
    `}renderLegend(){let e=["private","shared","public"],t=["indoor","semi_outdoor","outdoor"];return c`
      <div class="legend">
        <span class="group">
          <span class="caption">${s("map.legend.trust")}</span>
          ${e.map(o=>c`
              <span class="item">
                <span class="swatch trust-${o}"></span>${_("trust",o)}
              </span>
            `)}
        </span>
        <span class="group">
          <span class="caption">${s("map.legend.environment")}</span>
          ${t.map(o=>c`
              <span class="item">
                <span class="swatch env-${o}"></span>${_("environment",o)}
              </span>
            `)}
        </span>
      </div>
    `}renderBand(e,t){return Y`
      <g class="band">
        <rect x="0" y=${e.y-12} width=${t.width} height=${e.height+24} rx="12"></rect>
        <text class="band-label" x="12" y=${e.y-18}>${this.floorName(e.floorId)}</text>
      </g>
    `}renderEdge(e,t,o=!1){let n=t.get(e.area_a),a=t.get(e.area_b);if(!n||!a)return h;let u=pt(e),d=e.edge_id===this.selectedEdgeId,f=["edge",`barrier-${u.barrier}`,u.perimeter?"perimeter":"",o?"flagged":"",d?"selected":""].join(" ");return Y`
      <line
        class=${f}
        x1=${n.x} y1=${n.y} x2=${a.x} y2=${a.y}
        tabindex="0"
        @click=${()=>this.emitEdge(e)}
        @keydown=${$=>this.onKey($,()=>this.emitEdge(e))}
      ></line>
      ${u.glyph?Y`<text class="glyph" x=${(n.x+a.x)/2} y=${(n.y+a.y)/2}>${u.glyph}</text>`:h}
    `}renderNode(e,t,o){let n=t.get(e.area_id);if(!n)return h;let a=e.orphaned_at!==null,u=dt(e),d=["node",`trust-${lt(e.trust)}`,`env-${ct(e.environment)}`,u?"muted":"",o?"flagged":"",a?"orphaned":"",e.area_id===this.selectedAreaId?"selected":""].join(" ");return Y`
      <g
        class=${d}
        transform="translate(${n.x-Z/2}, ${n.y-le/2})"
        tabindex="0"
        @click=${()=>this.emitArea(e)}
        @keydown=${f=>this.onKey(f,()=>this.emitArea(e))}
      >
        <rect class="node-body" width=${Z} height=${le} rx="10"></rect>
        <text class="node-label" x=${Z/2} y=${le/2}>
          ${this.areaName(e.area_id,e)}
        </text>
        ${u?Y`<title>${s("map.needs_annotation")}</title>`:h}
        ${a?Y`<circle class="orphan-badge" cx=${Z-8} cy="8" r="7"></circle>
                <title>${s("map.orphaned")}</title>`:h}
      </g>
    `}currentView(){return this.viewOverride??this.contentExtent()}contentExtent(){let e=this.visibleAreas().map(t=>({areaId:t.area_id,floorId:this.areaFloor(t.area_id)}));return He(e,this.floorOrder(),{nodeWidth:Z,nodeHeight:le}).extent}toSvgPoint(e,t){let n=e.currentTarget.getBoundingClientRect();if(n.width===0||n.height===0)return{x:t.x,y:t.y};let a=Math.min(n.width/t.width,n.height/t.height),u=(n.width-t.width*a)/2,d=(n.height-t.height*a)/2;return{x:t.x+(e.clientX-n.left-u)/a,y:t.y+(e.clientY-n.top-d)/a}}onKey(e,t){(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),t())}emitArea(e){this.dispatchEvent(new CustomEvent("area-selected",{detail:{area:e},bubbles:!0,composed:!0}))}emitEdge(e){this.dispatchEvent(new CustomEvent("edge-selected",{detail:{edge:e},bubbles:!0,composed:!0}))}};O.styles=x`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .wrap {
      position: relative;
      width: 100%;
      height: 100%;
    }
    svg {
      width: 100%;
      height: 100%;
      background: var(--card-background-color, #fff);
      border-radius: 12px;
      touch-action: none;
      cursor: grab;
    }
    svg:active {
      cursor: grabbing;
    }
    .overlay {
      position: absolute;
      right: 12px;
      bottom: 8px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      pointer-events: none;
    }
    .overlay button {
      pointer-events: auto;
      padding: 4px 10px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 14px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
      cursor: pointer;
      font-size: 0.8em;
    }
    .overlay p {
      margin: 0;
      font-size: 0.75em;
      color: var(--secondary-text-color, #727272);
    }
    .legend {
      position: absolute;
      top: 8px;
      left: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      pointer-events: none;
      font-size: 0.72em;
      color: var(--secondary-text-color, #727272);
    }
    .legend .group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend .caption {
      font-weight: 500;
    }
    .legend .item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .legend .swatch {
      display: inline-block;
      width: 14px;
      height: 10px;
      border: 2px solid var(--divider-color, #bdbdbd);
      border-radius: 3px;
      background: var(--card-background-color, #fff);
    }
    .legend .swatch.trust-private {
      background: var(--topology-trust-private, rgba(3, 169, 244, 0.14));
    }
    .legend .swatch.trust-shared {
      background: var(--topology-trust-shared, rgba(76, 175, 80, 0.14));
    }
    .legend .swatch.trust-public {
      background: var(--topology-trust-public, rgba(255, 152, 0, 0.14));
    }
    .legend .swatch.env-outdoor {
      border-style: dashed;
    }
    .legend .swatch.env-semi_outdoor {
      border-style: dotted;
    }
    .band rect {
      fill: var(--secondary-background-color, rgba(0, 0, 0, 0.04));
      stroke: none;
    }
    .band-label {
      fill: var(--secondary-text-color, #727272);
      font-size: 15px;
      dominant-baseline: auto;
    }
    .edge {
      stroke: var(--primary-text-color, #212121);
      stroke-width: 3;
      opacity: 0.8;
      cursor: pointer;
    }
    .edge:focus,
    .edge.selected {
      outline: none;
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 5;
    }
    .barrier-open {
      stroke-dasharray: none;
      opacity: 1;
    }
    .barrier-door {
      stroke-dasharray: 10 6;
    }
    .barrier-solid {
      stroke-dasharray: 2 8;
      opacity: 0.5;
    }
    .edge.perimeter {
      stroke: var(--warning-color, #ff9800);
      stroke-width: 4;
    }
    .edge.flagged {
      stroke: var(--error-color, #f44336);
      stroke-width: 5;
    }
    .glyph {
      font-size: 18px;
      fill: var(--secondary-text-color, #727272);
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
    }
    .node {
      cursor: pointer;
    }
    .node-body {
      fill: var(--card-background-color, #fff);
      stroke: var(--divider-color, #bdbdbd);
      stroke-width: 2;
    }
    .trust-private .node-body {
      fill: var(--topology-trust-private, rgba(3, 169, 244, 0.14));
    }
    .trust-shared .node-body {
      fill: var(--topology-trust-shared, rgba(76, 175, 80, 0.14));
    }
    .trust-public .node-body {
      fill: var(--topology-trust-public, rgba(255, 152, 0, 0.14));
    }
    .env-outdoor .node-body {
      stroke-dasharray: 6 4;
    }
    .env-semi_outdoor .node-body {
      stroke-dasharray: 2 4;
    }
    .node.muted .node-body {
      opacity: 0.5;
      stroke-dasharray: 4 4;
    }
    .node.flagged .node-body {
      stroke: var(--error-color, #f44336);
      stroke-width: 4;
    }
    .node.orphaned .node-body {
      stroke: var(--error-color, #f44336);
    }
    .node:focus {
      outline: none;
    }
    .node:focus .node-body,
    .node.selected .node-body {
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 4;
    }
    .node-label {
      text-anchor: middle;
      dominant-baseline: middle;
      fill: var(--primary-text-color, #212121);
      font-size: 16px;
      pointer-events: none;
    }
    .orphan-badge {
      fill: var(--error-color, #f44336);
    }
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 16px;
      text-align: center;
      color: var(--secondary-text-color, #727272);
    }
  `,l([p({attribute:!1})],O.prototype,"hass",2),l([p({attribute:!1})],O.prototype,"areas",2),l([p({attribute:!1})],O.prototype,"edges",2),l([p({attribute:!1})],O.prototype,"floors",2),l([p({attribute:!1})],O.prototype,"health",2),l([p({attribute:!1})],O.prototype,"activeFloor",2),l([p({attribute:!1})],O.prototype,"focusScope",2),l([p({attribute:!1})],O.prototype,"selectedAreaId",2),l([p({attribute:!1})],O.prototype,"selectedEdgeId",2),l([b()],O.prototype,"viewOverride",2),O=l([S("topology-floor-map")],O);var X={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},ut=i=>(...r)=>({_$litDirective$:i,values:r}),we=class{constructor(r){}get _$AU(){return this._$AM._$AU}_$AT(r,e,t){this._$Ct=r,this._$AM=e,this._$Ci=t}_$AS(r,e){return this.update(r,e)}update(r,e){return this.render(...e)}};var{I:xo}=rt;var ht=i=>i.strings===void 0;var Jt={},mt=(i,r=Jt)=>i._$AH=r;var w=ut(class extends we{constructor(i){if(super(i),i.type!==X.PROPERTY&&i.type!==X.ATTRIBUTE&&i.type!==X.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!ht(i))throw Error("`live` bindings can only contain a single expression")}render(i){return i}update(i,[r]){if(r===P||r===h)return r;let e=i.element,t=i.name;if(i.type===X.PROPERTY){if(r===e[t])return P}else if(i.type===X.BOOLEAN_ATTRIBUTE){if(!!r===e.hasAttribute(t))return P}else if(i.type===X.ATTRIBUTE&&e.getAttribute(t)===r+"")return P;return mt(i),r}});function A(i,r){let e=`error.${r.code}`,t=s(e);i.dispatchEvent(new CustomEvent("topology-toast",{detail:{message:t===e?r.message:t},bubbles:!0,composed:!0}))}var Qt=["indoor","outdoor","semi_outdoor"],Zt=["private","shared","public"],Me="__custom__",L=class extends y{constructor(){super(...arguments);this.areaTypes={catalog:[],cascade:{}};this.type="";this.environment="";this.trust="";this.custom=!1}willUpdate(e){e.has("area")&&this.area&&(this.type=this.area.type??"",this.environment=this.area.environment??"",this.trust=this.area.trust??"",this.custom=this.type!==""&&!this.areaTypes.catalog.includes(this.type))}get dirty(){return this.type!==(this.area.type??"")||this.environment!==(this.area.environment??"")||this.trust!==(this.area.trust??"")}onTypeSelect(e){let t=e.target.value;if(t===Me){this.custom=!0,this.type="";return}this.custom=!1,this.applyType(t)}onCustomInput(e){this.type=e.target.value}applyType(e){this.type=e;let t=this.areaTypes.cascade[e];t!==void 0&&(t.environment!==null&&this.environment===""&&(this.environment=t.environment),t.trust!==null&&this.trust===""&&(this.trust=t.trust))}async save(){try{await this.client.updateArea(this.area.area_id,{type:this.type===""?null:this.type,environment:this.environment===""?null:this.environment,trust:this.trust===""?null:this.trust})}catch(e){A(this,e instanceof g?e:new g("store_error",String(e)))}}render(){return c`
      <div class="editor">
        <h3>${s("editor.area.title")}</h3>
        <label>
          ${s("editor.area.type")}
          <select .value=${w(this.custom?Me:this.type)} @change=${this.onTypeSelect}>
            <option value="" .selected=${!this.custom&&this.type===""}></option>
            ${this.areaTypes.catalog.map(e=>c`
                <option value=${e} .selected=${!this.custom&&this.type===e}>
                  ${_("type",e)}
                </option>
              `)}
            <option value=${Me} .selected=${this.custom}>
              ${s("editor.area.type.custom")}
            </option>
          </select>
        </label>
        ${this.custom?c`<label>
              ${s("editor.area.type.custom_label")}
              <input .value=${w(this.type)} @input=${this.onCustomInput} />
            </label>`:h}
        <p class="hint">${s("editor.area.type.hint")}</p>
        <label>
          ${s("editor.area.environment")}
          <select
            .value=${w(this.environment)}
            @change=${e=>{this.environment=e.target.value}}
          >
            <option value="" .selected=${this.environment===""}></option>
            ${Qt.map(e=>c`
                <option value=${e} .selected=${this.environment===e}>
                  ${_("environment",e)}
                </option>
              `)}
          </select>
        </label>
        <p class="hint">${s("editor.area.environment.hint")}</p>
        <label>
          ${s("editor.area.trust")}
          <select
            .value=${w(this.trust)}
            @change=${e=>{this.trust=e.target.value}}
          >
            <option value="" .selected=${this.trust===""}></option>
            ${Zt.map(e=>c`
                <option value=${e} .selected=${this.trust===e}>
                  ${_("trust",e)}
                </option>
              `)}
          </select>
        </label>
        <p class="hint">${s("editor.area.trust.hint")}</p>
        ${this.area.orphaned_at?c`<p class="orphan">${s("map.orphaned")}</p>`:h}
        <div class="actions">
          ${this.dirty?c`<span class="dirty">${s("editor.area.unsaved")}</span>`:h}
          <button class="primary" @click=${this.save}>${s("action.save")}</button>
        </div>
      </div>
    `}};L.styles=x`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
    }
    h3 {
      margin: 0 0 4px;
      color: var(--primary-text-color, #212121);
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.9em;
    }
    input,
    select {
      padding: 8px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .hint {
      margin: 0 0 4px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    .orphan {
      color: var(--error-color, #f44336);
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 4px;
    }
    .dirty {
      color: var(--warning-color, #ff9800);
      font-size: 0.85em;
    }
    button.primary {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      cursor: pointer;
    }
  `,l([p({attribute:!1})],L.prototype,"client",2),l([p({attribute:!1})],L.prototype,"area",2),l([p({attribute:!1})],L.prototype,"areaTypes",2),l([b()],L.prototype,"type",2),l([b()],L.prototype,"environment",2),l([b()],L.prototype,"trust",2),l([b()],L.prototype,"custom",2),L=l([S("topology-area-editor")],L);function B(i,r){let e=i.find(t=>t.preset_name===r);return e===void 0?null:{passage:e.passage,barrier:e.barrier,glazed:e.glazed_default,preset_name:e.preset_name}}function Re(i,r){return i.find(t=>t.preset_name===r)?.sensor_allowed??!1}var er=["N","E","S","W"],tr=new Set(["door","garage_door","window","opening"]),H=class extends y{constructor(){super(...arguments);this.presets=[];this.scope="interior";this.allowInlineTrust=!1;this.allowOverride=!1}get scopedPresets(){return this.presets.filter(e=>e.scope===this.scope)}get sensorAllowed(){let e=this.connection.preset_name;return e!==void 0&&this.presets.length>0?Re(this.presets,e):this.connection.barrier==="door"}sensorCandidates(){let e=this.hass?.states??{},t=Object.values(e).filter(o=>o.entity_id.startsWith("binary_sensor.")).map(o=>({entityId:o.entity_id,label:o.attributes.friendly_name??o.entity_id,preferred:tr.has(o.attributes.device_class??"")}));return t.sort((o,n)=>o.preferred!==n.preferred?o.preferred?-1:1:o.label.localeCompare(n.label)),t.map(({entityId:o,label:n})=>({entityId:o,label:n}))}emit(e,t=[]){let o={...this.connection,...e};for(let n of t)delete o[n];this.dispatchEvent(new CustomEvent("connection-changed",{detail:{connection:o},bubbles:!0,composed:!0}))}onPreset(e){let t=e.target.value,o=B(this.presets,t);if(o===null)return;let n=!Re(this.presets,t);this.emit(o,n?["sensor_entity_id"]:[])}onSide(e){let t=e.target.value;if(t===""){this.emit({},["side"]);return}this.emit({side:t})}onSensor(e){let t=e.target.value;if(t===""){this.emit({},["sensor_entity_id"]);return}this.emit({sensor_entity_id:t})}onInlineTrust(e){let t=e.target.value;if(t===""){this.emit({},["inline_trust"]);return}this.emit({inline_trust:t})}render(){let e=this.connection;return c`
      <div class="fields">
        <label>
          ${s("editor.edge.preset")}
          <select .value=${w(e.preset_name??"")} @change=${this.onPreset}>
            <option value="" .selected=${e.preset_name===void 0}></option>
            ${this.scopedPresets.map(t=>c`
                <option
                  value=${t.preset_name}
                  .selected=${e.preset_name===t.preset_name}
                >
                  ${_("preset",t.preset_name)}
                </option>
              `)}
          </select>
        </label>
        <p class="axes">
          ${_("passage",e.passage)} · ${_("barrier",e.barrier)}
        </p>
        <label>
          ${s("editor.connection.side")}
          <select .value=${w(e.side??"")} @change=${this.onSide}>
            <option value="" .selected=${e.side===void 0}>
              ${s("editor.beyond.unset")}
            </option>
            ${er.map(t=>c`
                <option value=${t} .selected=${e.side===t}>
                  ${_("side",t)}
                </option>
              `)}
          </select>
        </label>
        <label class="check">
          <input
            type="checkbox"
            .checked=${w(e.glazed??!1)}
            @change=${t=>this.emit({glazed:t.target.checked})}
          />
          <span>${s("editor.connection.glazed")}</span>
        </label>
        <label>
          ${s("editor.connection.sensor")}
          ${this.sensorAllowed?c`
                <select .value=${w(e.sensor_entity_id??"")} @change=${this.onSensor}>
                  <option value="" .selected=${e.sensor_entity_id===void 0}>
                    ${s("editor.connection.sensor.none")}
                  </option>
                  ${this.sensorCandidates().map(t=>c`
                      <option
                        value=${t.entityId}
                        .selected=${e.sensor_entity_id===t.entityId}
                      >
                        ${t.label}
                      </option>
                    `)}
                </select>
              `:c`<span class="disabled">${s("editor.connection.sensor.unavailable")}</span>`}
        </label>
        ${this.sensorAllowed?c`<p class="hint">${s("editor.connection.sensor.hint")}</p>`:h}
        ${this.allowInlineTrust?c`
              <label>
                ${s("editor.exterior.beyond_trust")}
                <select .value=${w(e.inline_trust??"")} @change=${this.onInlineTrust}>
                  <option value="" .selected=${e.inline_trust===void 0}></option>
                  ${["private","shared","public"].map(t=>c`
                      <option value=${t} .selected=${e.inline_trust===t}>
                        ${_("trust",t)}
                      </option>
                    `)}
                </select>
              </label>
              <p class="hint">${s("editor.exterior.beyond_trust.hint")}</p>
            `:h}
        ${this.allowOverride?c`
              <label class="check">
                <input
                  type="checkbox"
                  .checked=${w(e.perimeter_override??!1)}
                  @change=${t=>this.emit({perimeter_override:t.target.checked})}
                />
                <span>${s("editor.connection.override")}</span>
              </label>
              <p class="hint">${s("editor.connection.override.hint")}</p>
            `:h}
      </div>
    `}};H.styles=x`
    .fields {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.85em;
    }
    label.check {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }
    select,
    input[type="text"] {
      padding: 6px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .axes {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
    }
    .hint {
      margin: 0 0 2px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.75em;
      line-height: 1.4;
    }
    .disabled {
      color: var(--secondary-text-color, #727272);
      font-style: italic;
    }
  `,l([p({attribute:!1})],H.prototype,"hass",2),l([p({attribute:!1})],H.prototype,"connection",2),l([p({attribute:!1})],H.prototype,"presets",2),l([p({attribute:!1})],H.prototype,"scope",2),l([p({attribute:!1})],H.prototype,"allowInlineTrust",2),l([p({attribute:!1})],H.prototype,"allowOverride",2),H=l([S("topology-connection-fields")],H);var R=class extends y{constructor(){super(...arguments);this.presets=[];this.connections=[]}willUpdate(e){e.has("edge")&&this.edge&&(this.connections=this.edge.connections.map(t=>({...t})))}replaceConnection(e,t){let o=[...this.connections];o[e]=t,this.connections=o}addConnection(){let t=this.presets.filter(n=>n.scope==="interior")[0],o=t!==void 0?B(this.presets,t.preset_name):{passage:"level",barrier:"open"};this.connections=[...this.connections,o]}removeConnection(e){this.connections=this.connections.filter((t,o)=>o!==e)}async save(){if(this.connections.length===0){await this.deleteEdge();return}try{await this.client.upsertEdge(this.edge.area_a,this.edge.area_b,this.connections)}catch(e){A(this,e instanceof g?e:new g("store_error",String(e)))}}async deleteEdge(){try{await this.client.deleteEdge(this.edge.edge_id),this.dispatchEvent(new CustomEvent("selection-cleared",{bubbles:!0,composed:!0}))}catch(e){A(this,e instanceof g?e:new g("store_error",String(e)))}}areaName(e){return this.hass?.areas?.[e]?.name??e}axisSummary(){let e=this.edge;if(e.axis==="unknown"||e.level_delta===null)return s("editor.edge.axis.unknown");if(e.level_delta===0)return s("editor.edge.axis.horizontal");let t=e.level_delta>0?"editor.edge.axis.vertical_up":"editor.edge.axis.vertical_down";return s(t,{a:this.areaName(e.area_a),b:this.areaName(e.area_b),levels:Math.abs(e.level_delta)})}render(){return c`
      <div class="editor">
        <h3>${s("editor.edge.title")}</h3>
        <p class="axis">${this.axisSummary()}</p>
        <p class="hint">${s("editor.edge.hint")}</p>
        ${this.connections.map((e,t)=>c`
            <div class="connection">
              <topology-connection-fields
                .hass=${this.hass}
                .connection=${e}
                .presets=${this.presets}
                .scope=${"interior"}
                .allowOverride=${!0}
                @connection-changed=${o=>{o.stopPropagation(),this.replaceConnection(t,o.detail.connection)}}
              ></topology-connection-fields>
              <button class="remove" @click=${()=>this.removeConnection(t)}>
                ${s("action.remove")}
              </button>
            </div>
          `)}
        ${this.connections.length===0?c`<p class="warn">${s("editor.edge.delete")}</p>`:h}
        <div class="actions">
          <button @click=${this.addConnection}>${s("editor.edge.add")}</button>
          <button class="danger" @click=${this.deleteEdge}>${s("editor.edge.delete")}</button>
          <button class="primary" @click=${this.save}>${s("action.save")}</button>
        </div>
      </div>
    `}};R.styles=x`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    .axis {
      margin: 0;
      font-size: 0.85em;
    }
    .hint,
    .warn {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    .warn {
      color: var(--warning-color, #ff9800);
    }
    .connection {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
    }
    .remove {
      align-self: flex-end;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }
    button {
      padding: 6px 14px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
      cursor: pointer;
    }
    button.primary {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      border: none;
    }
    button.danger {
      color: var(--error-color, #f44336);
    }
  `,l([p({attribute:!1})],R.prototype,"client",2),l([p({attribute:!1})],R.prototype,"hass",2),l([p({attribute:!1})],R.prototype,"edge",2),l([p({attribute:!1})],R.prototype,"presets",2),l([b()],R.prototype,"connections",2),R=l([S("topology-edge-editor")],R);var rr=["N","E","S","W"],or=["outdoor","neighbor","earth"],ir={N:"S",S:"N",E:"W",W:"E"},nr={whole_property:"outdoor",unit_within_building:"neighbor"},N=class extends y{constructor(){super(...arguments);this.edges=[];this.occupancyExtent=null}async setSide(e,t){try{await this.client.setBeyond(this.area.area_id,e,t===""?null:t)}catch(o){A(this,o instanceof g?o:new g("store_error",String(o)))}}interiorSides(){let e=new Map,t=this.area.area_id;for(let o of this.edges){if(o.orphaned_at!==null)continue;let n=o.area_a===t,a=o.area_b===t;if(!n&&!a)continue;let u=n?o.area_b:o.area_a,d=this.hass?.areas?.[u]?.name??u;for(let f of o.connections){if(f.side===void 0)continue;let $=n?f.side:ir[f.side],m=e.get($)??[];m.includes(d)||m.push(d),e.set($,m)}}return e}render(){let e=this.interiorSides();return c`
      <div class="editor">
        <h3>${s("editor.beyond.title")}</h3>
        <p class="hint">${s("editor.beyond.hint")}</p>
        ${rr.map(t=>{let o=e.get(t),n=this.area.beyond[t],a=n===void 0&&o===void 0&&this.occupancyExtent!==null?nr[this.occupancyExtent]:null;return c`
            <div class="side">
              <label>
                <span class="side-name">${_("side",t)}</span>
                <select
                  .value=${w(n??"")}
                  @change=${u=>this.setSide(t,u.target.value)}
                >
                  <option value="" .selected=${n===void 0}>
                    ${s("editor.beyond.unset")}
                  </option>
                  ${or.map(u=>c`
                      <option value=${u} .selected=${n===u}>
                        ${_("beyond",u)}
                      </option>
                    `)}
                </select>
              </label>
              ${o!==void 0?c`<p class="interior">
                    ${s("editor.beyond.interior",{areas:o.join(", ")})}
                  </p>`:h}
              ${a!==null?c`<p class="suggestion">
                    <button class="link" @click=${()=>this.setSide(t,a)}>
                      ${s("editor.beyond.suggest",{value:_("beyond",a)})}
                    </button>
                  </p>`:h}
            </div>
          `})}
      </div>
    `}};N.styles=x`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      border-top: 1px solid var(--divider-color, #e0e0e0);
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    .hint {
      margin: 0 0 4px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.9em;
    }
    .side-name {
      min-width: 4.5em;
    }
    select {
      flex: 1;
      padding: 6px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .interior,
    .suggestion {
      margin: 0 0 2px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.72em;
    }
    button.link {
      padding: 0;
      border: none;
      background: none;
      color: var(--primary-color, #03a9f4);
      cursor: pointer;
      font: inherit;
      text-align: left;
    }
  `,l([p({attribute:!1})],N.prototype,"client",2),l([p({attribute:!1})],N.prototype,"hass",2),l([p({attribute:!1})],N.prototype,"area",2),l([p({attribute:!1})],N.prototype,"edges",2),l([p({attribute:!1})],N.prototype,"occupancyExtent",2),N=l([S("topology-beyond-editor")],N);var M=class extends y{constructor(){super(...arguments);this.presets=[];this.flagged=!1;this.connections=[]}willUpdate(e){e.has("area")&&this.area&&(this.connections=this.area.exterior_connections.map(t=>({...t})))}get exteriorPresets(){return this.presets.filter(e=>e.scope==="exterior")}addConnection(){let e=this.exteriorPresets,t=e.find(n=>n.preset_name==="window")??e[0],o=t!==void 0?B(this.presets,t.preset_name):{passage:"none",barrier:"door"};this.connections=[...this.connections,o]}replaceConnection(e,t){let o=[...this.connections];o[e]=t,this.connections=o}removeConnection(e){this.connections=this.connections.filter((t,o)=>o!==e)}async save(){try{await this.client.setExteriorConnections(this.area.area_id,this.connections)}catch(e){A(this,e instanceof g?e:new g("store_error",String(e)))}}declaredSides(){return Object.keys(this.area.beyond)}render(){let e=this.connections.filter(t=>t.side===void 0).length;return c`
      <div class="editor ${this.flagged?"flagged":""}">
        <h3>${s("editor.exterior.title")}</h3>
        <p class="hint">${s("editor.exterior.hint")}</p>
        ${this.connections.length===0?c`<p class="empty">${s("editor.exterior.none")}</p>`:h}
        ${this.connections.map((t,o)=>c`
            <div class="connection">
              <topology-connection-fields
                .hass=${this.hass}
                .connection=${t}
                .presets=${this.presets}
                .scope=${"exterior"}
                .allowInlineTrust=${!0}
                @connection-changed=${n=>{n.stopPropagation(),this.replaceConnection(o,n.detail.connection)}}
              ></topology-connection-fields>
              <button class="remove" @click=${()=>this.removeConnection(o)}>
                ${s("action.remove")}
              </button>
            </div>
          `)}
        ${e>0?c`<p class="warn">${s("editor.exterior.sideless")}</p>`:h}
        ${this.declaredSides().length>0?c`<p class="hint">
              ${s("editor.exterior.outer_sides",{sides:this.declaredSides().map(t=>_("side",t)).join(", ")})}
            </p>`:h}
        <div class="actions">
          <button @click=${this.addConnection}>${s("editor.edge.add")}</button>
          <button class="primary" @click=${this.save}>${s("action.save")}</button>
        </div>
      </div>
    `}};M.styles=x`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      border-top: 1px solid var(--divider-color, #e0e0e0);
      color: var(--primary-text-color, #212121);
      border-radius: 8px;
    }
    .editor.flagged {
      outline: 2px solid var(--error-color, #f44336);
    }
    h3 {
      margin: 0;
    }
    .hint,
    .empty {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    .warn {
      margin: 0;
      color: var(--warning-color, #ff9800);
      font-size: 0.78em;
      line-height: 1.4;
    }
    .connection {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
    }
    .remove {
      align-self: flex-end;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    button {
      padding: 6px 14px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
      cursor: pointer;
    }
    button.primary {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      border: none;
    }
  `,l([p({attribute:!1})],M.prototype,"client",2),l([p({attribute:!1})],M.prototype,"hass",2),l([p({attribute:!1})],M.prototype,"area",2),l([p({attribute:!1})],M.prototype,"presets",2),l([p({attribute:!1})],M.prototype,"flagged",2),l([b()],M.prototype,"connections",2),M=l([S("topology-exterior-editor")],M);var sr=new Set(["stairs","ramp","elevator","ladder","hatch"]);function ft(i,r){if(i===null||r===null)return"unknown";let e=r-i;return e===0?"same":e===1?"above":e===-1?"below":"distant"}function gt(i,r){let e=i.filter(o=>o.scope==="interior");if(r==="unknown")return e;let t=r!=="same";return e.filter(o=>o.passage==="none"||sr.has(o.passage)===t)}function vt(i,r){return i.level_delta===null?null:i.area_a===r?i.level_delta:-i.level_delta}var ar=["same","above","below","distant","unknown"],lr={same:"editor.neighbors.group.same",above:"editor.neighbors.group.above",below:"editor.neighbors.group.below",distant:"editor.neighbors.group.distant",unknown:"editor.neighbors.group.unknown"},C=class extends y{constructor(){super(...arguments);this.areas=[];this.edges=[];this.floors=[];this.presets=[];this.pickedArea="";this.pickedPreset="";this.busy=!1}willUpdate(e){e.has("area")&&(this.pickedArea="",this.pickedPreset="")}areaName(e){return this.hass?.areas?.[e]?.name??e}levelOf(e){let t=this.hass?.areas?.[e]?.floor_id??null;return t===null?null:this.floors.find(n=>n.floor_id===t)?.effective_level??null}relationTo(e){return ft(this.levelOf(this.area.area_id),this.levelOf(e))}currentNeighbors(){return this.edges.filter(e=>!e.orphaned_at&&(e.area_a===this.area.area_id||e.area_b===this.area.area_id)).map(e=>({edge:e,otherId:e.area_a===this.area.area_id?e.area_b:e.area_a}))}candidates(){let e=new Set(this.currentNeighbors().map(t=>t.otherId));return this.areas.filter(t=>t.area_id!==this.area.area_id&&t.orphaned_at===null&&!e.has(t.area_id)&&this.hass?.areas?.[t.area_id]!==void 0).map(t=>({areaId:t.area_id,name:this.areaName(t.area_id),relation:this.relationTo(t.area_id)})).sort((t,o)=>t.name.localeCompare(o.name))}offeredPresets(){let e=this.pickedArea===""?"unknown":this.relationTo(this.pickedArea);return gt(this.presets,e)}async addNeighbor(){if(this.pickedArea===""||this.pickedPreset==="")return;let e=B(this.presets,this.pickedPreset);if(e!==null){this.busy=!0;try{await this.client.upsertEdge(this.area.area_id,this.pickedArea,[e]),this.pickedArea="",this.pickedPreset=""}catch(t){A(this,t instanceof g?t:new g("store_error",String(t)))}finally{this.busy=!1}}}select(e){this.dispatchEvent(new CustomEvent("edge-selected",{detail:{edge:e},bubbles:!0,composed:!0}))}relationSummary(e,t){if(e.axis==="unknown"||e.level_delta===null)return s("editor.edge.axis.unknown");if(e.level_delta===0)return s("editor.edge.axis.horizontal");let o=vt(e,this.area.area_id)??0,n=o>0?"editor.edge.axis.vertical_up":"editor.edge.axis.vertical_down";return s(n,{a:this.areaName(this.area.area_id),b:this.areaName(t),levels:Math.abs(o)})}render(){let e=this.currentNeighbors(),t=this.candidates(),o=this.offeredPresets(),n=this.pickedArea!==""&&this.relationTo(this.pickedArea)==="distant";return c`
      <div class="editor">
        <h3>${s("editor.neighbors.title")}</h3>
        <p class="hint">${s("editor.neighbors.hint")}</p>
        ${e.length===0?c`<p class="empty">${s("editor.neighbors.none")}</p>`:c`<ul>
              ${e.map(({edge:a,otherId:u})=>c`
                  <li>
                    <div class="row">
                      <button class="link" @click=${()=>this.select(a)}>
                        ${this.areaName(u)}
                      </button>
                      <span class="kinds">
                        ${a.connections.map(d=>d.preset_name!==void 0?_("preset",d.preset_name):_("passage",d.passage)).join(", ")}
                      </span>
                    </div>
                    <p class="relation">${this.relationSummary(a,u)}</p>
                  </li>
                `)}
            </ul>`}
        ${t.length===0?h:c`
              <div class="add">
                <label>
                  ${s("editor.neighbors.area")}
                  <select
                    .value=${w(this.pickedArea)}
                    @change=${a=>{this.pickedArea=a.target.value,this.pickedPreset=""}}
                  >
                    <option value="" .selected=${this.pickedArea===""}>
                      ${s("editor.neighbors.pick")}
                    </option>
                    ${ar.map(a=>{let u=t.filter(d=>d.relation===a);return u.length===0?h:c`
                        <optgroup label=${s(lr[a])}>
                          ${u.map(d=>c`
                              <option value=${d.areaId} .selected=${this.pickedArea===d.areaId}>
                                ${d.name}
                              </option>
                            `)}
                        </optgroup>
                      `})}
                  </select>
                </label>
                ${n?c`<p class="warn">${s("editor.neighbors.distant_warning")}</p>`:h}
                <label>
                  ${s("editor.edge.preset")}
                  <select
                    .value=${w(this.pickedPreset)}
                    @change=${a=>{this.pickedPreset=a.target.value}}
                  >
                    <option value="" .selected=${this.pickedPreset===""}></option>
                    ${o.map(a=>c`
                        <option
                          value=${a.preset_name}
                          .selected=${this.pickedPreset===a.preset_name}
                        >
                          ${_("preset",a.preset_name)}
                        </option>
                      `)}
                  </select>
                </label>
                <div class="actions">
                  <button
                    class="primary"
                    ?disabled=${this.busy||this.pickedArea===""||this.pickedPreset===""}
                    @click=${this.addNeighbor}
                  >
                    ${s("editor.neighbors.add")}
                  </button>
                </div>
              </div>
            `}
      </div>
    `}};C.styles=x`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      border-top: 1px solid var(--divider-color, #e0e0e0);
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    .hint {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    ul {
      margin: 4px 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .kinds {
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      text-align: right;
    }
    .relation {
      margin: 2px 0 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.75em;
    }
    .empty {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.85em;
    }
    .add {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
      padding-top: 8px;
      border-top: 1px dashed var(--divider-color, #e0e0e0);
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.85em;
    }
    select {
      padding: 6px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .warn {
      margin: 0;
      color: var(--warning-color, #ff9800);
      font-size: 0.75em;
      line-height: 1.4;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    button.link {
      padding: 0;
      border: none;
      background: none;
      color: var(--primary-color, #03a9f4);
      cursor: pointer;
      font: inherit;
      text-align: left;
    }
    button.primary {
      padding: 6px 14px;
      border: none;
      border-radius: 6px;
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      cursor: pointer;
    }
    button.primary[disabled] {
      opacity: 0.5;
      cursor: default;
    }
  `,l([p({attribute:!1})],C.prototype,"client",2),l([p({attribute:!1})],C.prototype,"hass",2),l([p({attribute:!1})],C.prototype,"area",2),l([p({attribute:!1})],C.prototype,"areas",2),l([p({attribute:!1})],C.prototype,"edges",2),l([p({attribute:!1})],C.prototype,"floors",2),l([p({attribute:!1})],C.prototype,"presets",2),l([b()],C.prototype,"pickedArea",2),l([b()],C.prototype,"pickedPreset",2),l([b()],C.prototype,"busy",2),C=l([S("topology-neighbors-editor")],C);var z=class extends y{constructor(){super(...arguments);this.floors=[];this.flagged=new Set}floorName(e){return this.hass?.floors?.[e]?.name??e}async setLevel(e,t){let o=t.trim()===""?null:Number.parseInt(t,10);if(!(o!==null&&Number.isNaN(o)))try{await this.client.setFloorLevel(e.floor_id,o)}catch(n){A(this,n instanceof g?n:new g("store_error",String(n)))}}render(){return c`
      <div class="editor">
        <h3>${s("editor.floor.title")}</h3>
        <p class="hint">${s("editor.floor.hint")}</p>
        ${this.floors.length===0?c`<p class="hint">${s("editor.floor.unset")}</p>`:h}
        ${this.floors.map(e=>c`
            <div class="row ${this.flagged.has(e.floor_id)?"flagged":""}">
              <span class="name">${this.floorName(e.floor_id)}</span>
              ${e.registry_level===null?c`
                    <label>
                      ${s("editor.floor.override")}
                      <input
                        type="number"
                        .value=${w(e.level_override===null?"":String(e.level_override))}
                        @change=${t=>this.setLevel(e,t.target.value)}
                      />
                    </label>
                  `:c`<span class="registry">
                    ${s("editor.floor.from_registry")}: ${e.registry_level}
                  </span>`}
              <span class="effective">
                ${s("editor.floor.effective")}:
                ${e.effective_level===null?"\u2014":e.effective_level}
              </span>
            </div>
          `)}
      </div>
    `}};z.styles=x`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    .hint {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      border-radius: 6px;
    }
    .row.flagged {
      outline: 2px solid var(--error-color, #f44336);
    }
    .name {
      flex: 1;
      font-weight: 500;
    }
    label {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--secondary-text-color, #727272);
    }
    input {
      width: 64px;
      padding: 6px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .effective,
    .registry {
      color: var(--secondary-text-color, #727272);
      font-size: 0.9em;
    }
  `,l([p({attribute:!1})],z.prototype,"client",2),l([p({attribute:!1})],z.prototype,"hass",2),l([p({attribute:!1})],z.prototype,"floors",2),l([p({attribute:!1})],z.prototype,"flagged",2),z=l([S("topology-floor-editor")],z);var bt=["aliases","labels"],cr="topology",dr="import_from_core",yt="topology.first-run.dismissed";function Ne(i){let r=new Set;if(!i)return r;let e=null;try{e=i.getItem(yt)}catch{return r}if(e===null)return r;let t;try{t=JSON.parse(e)}catch{return r}if(!Array.isArray(t))return r;for(let o of t)bt.includes(o)&&r.add(o);return r}function $t(i,r){let e=Ne(i);if(e.add(r),i)try{i.setItem(yt,JSON.stringify([...e]))}catch{}return e}function xt(i,r=new Set){return i?bt.filter(e=>i.imports_done_at[e]===null&&!r.has(e)):[]}async function _t(i,r){if(typeof i.callService!="function")throw new Error("hass.callService is unavailable");await i.callService(cr,dr,{source:r})}var W=class extends y{constructor(){super(...arguments);this.dismissed=new Set;this.running=null}connectedCallback(){super.connectedCallback(),this.dismissed=Ne(this.storage)}get storage(){try{return window.localStorage??null}catch{return null}}async runSource(e){this.running=e;try{await _t(this.hass,e)}catch(t){A(this,t instanceof g?t:new g("store_error",String(t)))}finally{this.running=null}}dismissSource(e){this.dismissed=$t(this.storage,e)}render(){let e=xt(this.homeConfig,this.dismissed);return e.length===0?h:c`
      <div class="card">
        <h3>${s("first_run.title")}</h3>
        <p class="hint">${s("first_run.hint")}</p>
        ${e.map(t=>c`
            <div class="row">
              <span class="label">${s(`first_run.source.${t}`)}</span>
              <div class="actions">
                <button
                  class="primary"
                  ?disabled=${this.running!==null}
                  @click=${()=>this.runSource(t)}
                >
                  ${this.running===t?s("first_run.running"):s("first_run.import")}
                </button>
                <button
                  class="link"
                  ?disabled=${this.running!==null}
                  @click=${()=>this.dismissSource(t)}
                >
                  ${s("first_run.dismiss")}
                </button>
              </div>
            </div>
          `)}
      </div>
    `}};W.styles=x`
    .card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    p.hint {
      margin: 0;
      color: var(--secondary-text-color, #727272);
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    button.primary {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      cursor: pointer;
    }
    button.link {
      padding: 8px;
      border: none;
      background: none;
      color: var(--secondary-text-color, #727272);
      cursor: pointer;
      text-decoration: underline;
    }
    button[disabled] {
      opacity: 0.6;
      cursor: default;
    }
  `,l([p({attribute:!1})],W.prototype,"hass",2),l([p({attribute:!1})],W.prototype,"homeConfig",2),l([b()],W.prototype,"dismissed",2),l([b()],W.prototype,"running",2),W=l([S("topology-first-run-card")],W);var pr=["whole_property","unit_within_building"],T=class extends y{constructor(){super(...arguments);this.occupancy="whole_property";this.threshold=3;this.projectEnvironment=!1;this.projectType=!1;this.projectTrust=!1}willUpdate(e){e.has("homeConfig")&&this.homeConfig&&(this.occupancy=this.homeConfig.occupancy_extent,this.threshold=this.homeConfig.unannotated_repair_threshold,this.projectEnvironment=this.homeConfig.projection_toggles.environment,this.projectType=this.homeConfig.projection_toggles.type,this.projectTrust=this.homeConfig.projection_toggles.trust)}async save(){try{await this.client.updateHomeConfig({occupancy_extent:this.occupancy,unannotated_repair_threshold:this.threshold,projection_toggles:{environment:this.projectEnvironment,type:this.projectType,trust:this.projectTrust}})}catch(e){A(this,e instanceof g?e:new g("store_error",String(e)))}}render(){return c`
      <div class="editor">
        <h3>${s("editor.home.title")}</h3>
        <label>
          ${s("editor.home.occupancy")}
          <select
            .value=${w(this.occupancy)}
            @change=${e=>{this.occupancy=e.target.value}}
          >
            ${pr.map(e=>c`
                <option value=${e} .selected=${this.occupancy===e}>
                  ${_("occupancy",e)}
                </option>
              `)}
          </select>
        </label>
        <p class="hint">${s("editor.home.occupancy.hint")}</p>
        <label>
          ${s("editor.home.threshold")}
          <input
            type="number"
            min="1"
            max="100"
            .value=${w(String(this.threshold))}
            @change=${e=>{this.threshold=Number.parseInt(e.target.value,10)||1}}
          />
        </label>
        <p class="hint">${s("editor.home.threshold.hint")}</p>
        <h4>${s("editor.home.projection")}</h4>
        <p class="hint">${s("editor.home.projection.hint")}</p>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${w(this.projectEnvironment)}
            @change=${e=>{this.projectEnvironment=e.target.checked}}
          />
          ${s("editor.home.project_environment")}
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${w(this.projectType)}
            @change=${e=>{this.projectType=e.target.checked}}
          />
          ${s("editor.home.project_type")}
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${w(this.projectTrust)}
            @change=${e=>{this.projectTrust=e.target.checked}}
          />
          ${s("editor.home.project_trust")}
        </label>
        <div class="actions">
          <button class="primary" @click=${this.save}>${s("action.save")}</button>
        </div>
      </div>
    `}};T.styles=x`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    h4 {
      margin: 8px 0 0;
    }
    .hint {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--secondary-text-color, #727272);
    }
    label.checkbox {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }
    select,
    input[type="number"] {
      padding: 8px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    button.primary {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      cursor: pointer;
    }
  `,l([p({attribute:!1})],T.prototype,"client",2),l([p({attribute:!1})],T.prototype,"homeConfig",2),l([b()],T.prototype,"occupancy",2),l([b()],T.prototype,"threshold",2),l([b()],T.prototype,"projectEnvironment",2),l([b()],T.prototype,"projectType",2),l([b()],T.prototype,"projectTrust",2),T=l([S("topology-home-config-editor")],T);var D=class extends y{constructor(){super(...arguments);this.areas=[];this.edges=[]}get orphanedAreas(){return this.areas.filter(e=>e.orphaned_at!==null)}get orphanedEdges(){return this.edges.filter(e=>e.orphaned_at!==null)}areaLabel(e){return this.hass?.areas?.[e]?.name??e}restorable(e){return!!this.hass?.areas?.[e.area_a]&&!!this.hass?.areas?.[e.area_b]}async restore(e){try{await this.client.restoreEdge(e.edge_id)}catch(t){A(this,t instanceof g?t:new g("store_error",String(t)))}}render(){let e=this.orphanedAreas,t=this.orphanedEdges;return e.length===0&&t.length===0?c`<div class="editor"><p>${s("editor.orphans.empty")}</p></div>`:c`
      <div class="editor">
        <h3>${s("editor.orphans.title")}</h3>
        ${e.map(o=>c`<div class="row"><span>${this.areaLabel(o.area_id)}</span></div>`)}
        ${t.map(o=>c`
            <div class="row">
              <span>${this.areaLabel(o.area_a)} ↔ ${this.areaLabel(o.area_b)}</span>
              <button
                ?disabled=${!this.restorable(o)}
                @click=${()=>this.restore(o)}
              >
                ${s("editor.orphans.restore")}
              </button>
            </div>
          `)}
      </div>
    `}};D.styles=x`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
    button {
      padding: 6px 12px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
      cursor: pointer;
    }
    button[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `,l([p({attribute:!1})],D.prototype,"client",2),l([p({attribute:!1})],D.prototype,"hass",2),l([p({attribute:!1})],D.prototype,"areas",2),l([p({attribute:!1})],D.prototype,"edges",2),D=l([S("topology-orphans-view")],D);var Ue="__all__",k=class extends y{constructor(){super(...arguments);this.narrow=!1;this.store=null;this.view="map";this.focusScope=null;this.activeFloor=null;this.selectedAreaId=null;this.selectedEdgeId=null;this.toastMessage=null;this.client=null;this.removeListener=null;this.onToast=e=>{this.toastMessage=e.detail.message,window.setTimeout(()=>{this.toastMessage=null},4e3)};this.onAreaSelected=e=>{this.selectedAreaId=e.detail.area.area_id,this.selectedEdgeId=null};this.onEdgeSelected=e=>{this.selectedEdgeId=e.detail.edge.edge_id,this.selectedAreaId=null};this.clearSelection=()=>{this.selectedAreaId=null,this.selectedEdgeId=null};this.onKeyDown=e=>{e.key==="Escape"&&(this.selectedAreaId!==null||this.selectedEdgeId!==null)&&this.clearSelection()};this.goHome=()=>{this.view="map",this.focusScope=null,this.clearSelection(),this.syncUrl()}}connectedCallback(){super.connectedCallback(),this.client=new xe(this.hass.connection);let e=new _e(this.client);this.store=e,this.removeListener=e.addListener(()=>this.requestUpdate());let t=nt(window.location.search);this.view=t.view,this.focusScope=t.focus,e.connect(),this.addEventListener("topology-toast",this.onToast),this.addEventListener("area-selected",this.onAreaSelected),this.addEventListener("edge-selected",this.onEdgeSelected),this.addEventListener("selection-cleared",this.clearSelection),this.addEventListener("keydown",this.onKeyDown)}disconnectedCallback(){super.disconnectedCallback(),this.removeListener?.(),this.store?.dispose(),this.removeEventListener("topology-toast",this.onToast),this.removeEventListener("area-selected",this.onAreaSelected),this.removeEventListener("edge-selected",this.onEdgeSelected),this.removeEventListener("selection-cleared",this.clearSelection),this.removeEventListener("keydown",this.onKeyDown)}willUpdate(e){e.has("hass")&&this.store&&this.hass&&this.store.handleConnectionState(this.hass.connection.connected??!0)}syncUrl(){let e=it(this.focusScope),t=`${window.location.pathname}${e}`;t!==`${window.location.pathname}${window.location.search}`&&window.history.replaceState(window.history.state,"",t)}get snapshot(){return this.store?.state.snapshot??null}get health(){return this.store?.state.health??null}get selectedArea(){return this.selectedAreaId===null?null:this.snapshot?.areas.find(e=>e.area_id===this.selectedAreaId)??null}get selectedEdge(){return this.selectedEdgeId===null?null:this.snapshot?.edges.find(e=>e.edge_id===this.selectedEdgeId)??null}floorButtons(){let e=this.snapshot,t=[{id:Ue,label:s("panel.floor.all")}];for(let o of e?.floors??[])t.push({id:o.floor_id,label:this.hass.floors?.[o.floor_id]?.name??o.floor_id});return t.push({id:ce,label:s("panel.floor.outdoor")}),t}render(){let e=this.store?.state;return c`
      <div class="root">
        ${e&&!e.connected?c`<div class="banner reconnecting">${s("banner.reconnecting")}</div>`:h}
        ${e?.error?c`<div class="banner error">${s("banner.error")}</div>`:h}
        <header>
          <h1>${s("panel.title")}</h1>
          <nav class="views">
            <button
              class=${this.isHome()?"active":""}
              @click=${this.goHome}
              title=${s("panel.nav.back")}
            >
              ${s("panel.nav.home")}
            </button>
            <button
              class=${this.view==="floors"?"active":""}
              @click=${()=>this.openView("floors")}
            >
              ${s("panel.nav.floors")}
            </button>
            <button
              class=${this.view==="orphans"?"active":""}
              @click=${()=>this.openView("orphans")}
            >
              ${s("panel.nav.orphans")}
            </button>
          </nav>
        </header>
        <nav class="floors">
          ${this.floorButtons().map(t=>c`
              <button
                class=${(this.activeFloor??Ue)===t.id?"active":""}
                @click=${()=>{this.activeFloor=t.id===Ue?null:t.id}}
              >
                ${t.label}
              </button>
            `)}
        </nav>
        <div class="body">
          <div class="map">${this.renderMap()}</div>
          <aside class="side">${this.renderSide()}</aside>
        </div>
        ${this.toastMessage?c`<div class="toast" role="alert">${this.toastMessage}</div>`:h}
      </div>
    `}isHome(){return this.view==="map"&&this.selectedAreaId===null&&this.selectedEdgeId===null}openView(e){this.view=e,this.focusScope=e==="floors"?"floors":e==="orphans"?"orphans":null,this.clearSelection(),this.syncUrl()}renderMap(){let e=this.snapshot;return e===null?c`<div class="empty">…</div>`:c`
      <topology-floor-map
        .hass=${this.hass}
        .areas=${e.areas}
        .edges=${e.edges}
        .floors=${e.floors}
        .health=${this.health}
        .activeFloor=${this.activeFloor}
        .focusScope=${this.focusScope}
        .selectedAreaId=${this.selectedAreaId}
        .selectedEdgeId=${this.selectedEdgeId}
      ></topology-floor-map>
    `}renderSide(){let e=this.snapshot;if(e===null||this.client===null)return h;let t=this.selectedEdge;if(t!==null)return c`
        ${this.renderCloseBar(this.edgeTitle(t))}
        <topology-edge-editor
          .client=${this.client}
          .hass=${this.hass}
          .edge=${t}
          .presets=${e.presets}
        ></topology-edge-editor>
      `;let o=this.selectedArea;if(o!==null){let n=(this.health?.exterior_on_non_outdoor_side??[]).includes(o.area_id);return c`
        ${this.renderCloseBar(this.hass.areas?.[o.area_id]?.name??o.area_id)}
        <topology-area-editor
          .client=${this.client}
          .area=${o}
          .areaTypes=${e.area_types}
        ></topology-area-editor>
        <topology-neighbors-editor
          .client=${this.client}
          .hass=${this.hass}
          .area=${o}
          .areas=${e.areas}
          .edges=${e.edges}
          .floors=${e.floors}
          .presets=${e.presets}
        ></topology-neighbors-editor>
        <topology-beyond-editor
          .client=${this.client}
          .hass=${this.hass}
          .area=${o}
          .edges=${e.edges}
          .occupancyExtent=${e.home_config.occupancy_extent}
        ></topology-beyond-editor>
        <topology-exterior-editor
          .client=${this.client}
          .hass=${this.hass}
          .area=${o}
          .presets=${e.presets}
          .flagged=${n}
        ></topology-exterior-editor>
      `}return this.view==="floors"?c`
        ${this.renderCloseBar(s("panel.nav.floors"))}
        <topology-floor-editor
          .client=${this.client}
          .hass=${this.hass}
          .floors=${e.floors}
          .flagged=${new Set(this.health?.indoor_areas_without_floor??[])}
        ></topology-floor-editor>
      `:this.view==="orphans"?c`
        ${this.renderCloseBar(s("panel.nav.orphans"))}
        <topology-orphans-view
          .client=${this.client}
          .hass=${this.hass}
          .areas=${e.areas}
          .edges=${e.edges}
        ></topology-orphans-view>
      `:c`
      ${this.renderFlagged()}
      <topology-first-run-card
        .hass=${this.hass}
        .homeConfig=${e.home_config}
      ></topology-first-run-card>
      <topology-home-config-editor
        .client=${this.client}
        .homeConfig=${e.home_config}
      ></topology-home-config-editor>
    `}renderCloseBar(e){return c`
      <div class="close-bar">
        <span class="crumb">${e}</span>
        <button @click=${this.goHome} title=${s("panel.nav.back")}>
          ${s("action.close")}
        </button>
      </div>
    `}edgeTitle(e){let t=o=>this.hass.areas?.[o]?.name??o;return s("editor.edge.between",{a:t(e.area_a),b:t(e.area_b)})}renderFlagged(){if(this.focusScope===null||this.health===null)return h;if(this.focusScope==="geometry")return this.renderFlaggedEdges();let e=this.focusScope==="unannotated"?"unannotated_areas":this.focusScope==="isolated"?"isolated_areas":this.focusScope==="bearings"?"contradictory_bearings":this.focusScope==="exterior"?"exterior_on_non_outdoor_side":null;if(e===null)return h;let t=this.health[e],o=this.focusScope==="unannotated"?s("sidebar.unannotated"):this.focusScope==="isolated"?s("sidebar.isolated"):this.focusScope==="bearings"?s("sidebar.bearings"):s("editor.exterior.title");return c`
      <div class="flagged-list">
        <h3>${o}</h3>
        ${t.length===0?c`<p>${s("sidebar.none")}</p>`:c`<ul>
              ${t.map(n=>c`<li>
                  <button
                    class="link"
                    @click=${()=>{this.selectedAreaId=n,this.selectedEdgeId=null}}
                  >
                    ${this.hass.areas?.[n]?.name??n}
                  </button>
                </li>`)}
            </ul>`}
      </div>
    `}renderFlaggedEdges(){let e=this.health,t=this.snapshot;if(e===null||t===null)return h;let o=[{title:s("sidebar.spanning"),ids:e.edges_spanning_multiple_floors??[]},{title:s("sidebar.no_climb"),ids:e.vertical_edges_without_vertical_passage??[]}];return c`
      <div class="flagged-list">
        ${o.map(n=>c`
            <h3>${n.title}</h3>
            ${n.ids.length===0?c`<p>${s("sidebar.none")}</p>`:c`<ul>
                  ${n.ids.map(a=>{let u=t.edges.find(d=>d.edge_id===a);return c`<li>
                      <button
                        class="link"
                        @click=${()=>{this.selectedEdgeId=a,this.selectedAreaId=null}}
                      >
                        ${u!==void 0?this.edgeTitle(u):a}
                      </button>
                    </li>`})}
                </ul>`}
          `)}
      </div>
    `}};k.styles=x`
    :host {
      display: block;
      height: 100%;
      background: var(--primary-background-color, #fafafa);
      color: var(--primary-text-color, #212121);
    }
    .root {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      background: var(--app-header-background-color, var(--primary-color, #03a9f4));
      color: var(--app-header-text-color, #fff);
    }
    h1 {
      margin: 0;
      font-size: 1.2em;
    }
    nav.views {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    nav.views button {
      padding: 6px 12px;
      border: none;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.2);
      color: inherit;
      cursor: pointer;
    }
    nav.views button.active {
      background: rgba(255, 255, 255, 0.9);
      color: var(--primary-color, #03a9f4);
    }
    nav.floors {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 8px 16px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      background: var(--card-background-color, #fff);
    }
    nav.floors button {
      padding: 4px 12px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 16px;
      background: transparent;
      color: var(--primary-text-color, #212121);
      cursor: pointer;
      font-size: 0.9em;
    }
    nav.floors button.active {
      background: var(--primary-color, #03a9f4);
      border-color: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .map {
      flex: 2;
      padding: 16px;
      min-width: 0;
    }
    aside.side {
      flex: 1;
      max-width: 420px;
      overflow-y: auto;
      border-left: 1px solid var(--divider-color, #e0e0e0);
      background: var(--card-background-color, #fff);
    }
    .close-bar {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      background: var(--card-background-color, #fff);
    }
    .close-bar .crumb {
      font-weight: 500;
    }
    .close-bar button {
      padding: 4px 12px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: transparent;
      color: var(--primary-text-color, #212121);
      cursor: pointer;
    }
    .banner {
      padding: 8px 16px;
      text-align: center;
      color: #fff;
    }
    .banner.reconnecting {
      background: var(--warning-color, #ff9800);
    }
    .banner.error {
      background: var(--error-color, #f44336);
    }
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--secondary-text-color, #727272);
    }
    .flagged-list {
      padding: 16px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
    .flagged-list h3 {
      margin: 0 0 8px;
    }
    .flagged-list ul {
      margin: 0;
      padding-left: 18px;
    }
    button.link {
      padding: 0;
      border: none;
      background: none;
      color: var(--primary-color, #03a9f4);
      cursor: pointer;
      font: inherit;
      text-align: left;
    }
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      border-radius: 8px;
      background: var(--error-color, #f44336);
      color: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    @media (max-width: 870px) {
      .body {
        flex-direction: column;
      }
      aside.side {
        max-width: none;
        border-left: none;
        border-top: 1px solid var(--divider-color, #e0e0e0);
      }
    }
  `,l([p({attribute:!1})],k.prototype,"hass",2),l([p({attribute:!1})],k.prototype,"narrow",2),l([p({attribute:!1})],k.prototype,"route",2),l([p({attribute:!1})],k.prototype,"panel",2),l([b()],k.prototype,"store",2),l([b()],k.prototype,"view",2),l([b()],k.prototype,"focusScope",2),l([b()],k.prototype,"activeFloor",2),l([b()],k.prototype,"selectedAreaId",2),l([b()],k.prototype,"selectedEdgeId",2),l([b()],k.prototype,"toastMessage",2),k=l([S("topology-panel")],k);export{k as TopologyPanel};
//# sourceMappingURL=topology-panel.js.map
