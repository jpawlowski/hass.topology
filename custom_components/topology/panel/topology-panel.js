var it=Object.defineProperty;var nt=Object.getOwnPropertyDescriptor;var a=(s,t,e,r)=>{for(var o=r>1?void 0:r?nt(t,e):t,i=s.length-1,n;i>=0;i--)(n=s[i])&&(o=(r?n(t,e,o):n(o))||o);return r&&o&&it(t,e,o),o};var ee=globalThis,te=ee.ShadowRoot&&(ee.ShadyCSS===void 0||ee.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,ce=Symbol(),Ae=new WeakMap,K=class{constructor(t,e,r){if(this._$cssResult$=!0,r!==ce)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(te&&t===void 0){let r=e!==void 0&&e.length===1;r&&(t=Ae.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),r&&Ae.set(e,t))}return t}toString(){return this.cssText}},we=s=>new K(typeof s=="string"?s:s+"",void 0,ce),$=(s,...t)=>{let e=s.length===1?s[0]:t.reduce((r,o,i)=>r+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(o)+s[i+1],s[0]);return new K(e,s,ce)},Ce=(s,t)=>{if(te)s.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let e of t){let r=document.createElement("style"),o=ee.litNonce;o!==void 0&&r.setAttribute("nonce",o),r.textContent=e.cssText,s.appendChild(r)}},de=te?s=>s:s=>s instanceof CSSStyleSheet?(t=>{let e="";for(let r of t.cssRules)e+=r.cssText;return we(e)})(s):s;var{is:at,defineProperty:lt,getOwnPropertyDescriptor:ct,getOwnPropertyNames:dt,getOwnPropertySymbols:pt,getPrototypeOf:ut}=Object,re=globalThis,Oe=re.trustedTypes,ht=Oe?Oe.emptyScript:"",mt=re.reactiveElementPolyfillSupport,Y=(s,t)=>s,V={toAttribute(s,t){switch(t){case Boolean:s=s?ht:null;break;case Object:case Array:s=s==null?s:JSON.stringify(s)}return s},fromAttribute(s,t){let e=s;switch(t){case Boolean:e=s!==null;break;case Number:e=s===null?null:Number(s);break;case Object:case Array:try{e=JSON.parse(s)}catch{e=null}}return e}},oe=(s,t)=>!at(s,t),ke={attribute:!0,type:String,converter:V,reflect:!1,useDefault:!1,hasChanged:oe};Symbol.metadata??=Symbol("metadata"),re.litPropertyMetadata??=new WeakMap;var P=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=ke){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){let r=Symbol(),o=this.getPropertyDescriptor(t,r,e);o!==void 0&&lt(this.prototype,t,o)}}static getPropertyDescriptor(t,e,r){let{get:o,set:i}=ct(this.prototype,t)??{get(){return this[e]},set(n){this[e]=n}};return{get:o,set(n){let d=o?.call(this);i?.call(this,n),this.requestUpdate(t,d,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??ke}static _$Ei(){if(this.hasOwnProperty(Y("elementProperties")))return;let t=ut(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(Y("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Y("properties"))){let e=this.properties,r=[...dt(e),...pt(e)];for(let o of r)this.createProperty(o,e[o])}let t=this[Symbol.metadata];if(t!==null){let e=litPropertyMetadata.get(t);if(e!==void 0)for(let[r,o]of e)this.elementProperties.set(r,o)}this._$Eh=new Map;for(let[e,r]of this.elementProperties){let o=this._$Eu(e,r);o!==void 0&&this._$Eh.set(o,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t)){let r=new Set(t.flat(1/0).reverse());for(let o of r)e.unshift(de(o))}else t!==void 0&&e.push(de(t));return e}static _$Eu(t,e){let r=e.attribute;return r===!1?void 0:typeof r=="string"?r:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){let t=new Map,e=this.constructor.elementProperties;for(let r of e.keys())this.hasOwnProperty(r)&&(t.set(r,this[r]),delete this[r]);t.size>0&&(this._$Ep=t)}createRenderRoot(){let t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Ce(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,r){this._$AK(t,r)}_$ET(t,e){let r=this.constructor.elementProperties.get(t),o=this.constructor._$Eu(t,r);if(o!==void 0&&r.reflect===!0){let i=(r.converter?.toAttribute!==void 0?r.converter:V).toAttribute(e,r.type);this._$Em=t,i==null?this.removeAttribute(o):this.setAttribute(o,i),this._$Em=null}}_$AK(t,e){let r=this.constructor,o=r._$Eh.get(t);if(o!==void 0&&this._$Em!==o){let i=r.getPropertyOptions(o),n=typeof i.converter=="function"?{fromAttribute:i.converter}:i.converter?.fromAttribute!==void 0?i.converter:V;this._$Em=o;let d=n.fromAttribute(e,i.type);this[o]=d??this._$Ej?.get(o)??d,this._$Em=null}}requestUpdate(t,e,r,o=!1,i){if(t!==void 0){let n=this.constructor;if(o===!1&&(i=this[t]),r??=n.getPropertyOptions(t),!((r.hasChanged??oe)(i,e)||r.useDefault&&r.reflect&&i===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,r))))return;this.C(t,e,r)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:r,reflect:o,wrapped:i},n){r&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),i!==!0||n!==void 0)||(this._$AL.has(t)||(this.hasUpdated||r||(e=void 0),this._$AL.set(t,e)),o===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[o,i]of this._$Ep)this[o]=i;this._$Ep=void 0}let r=this.constructor.elementProperties;if(r.size>0)for(let[o,i]of r){let{wrapped:n}=i,d=this[o];n!==!0||this._$AL.has(o)||d===void 0||this.C(o,void 0,i,d)}}let t=!1,e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(r=>r.hostUpdate?.()),this.update(e)):this._$EM()}catch(r){throw t=!1,this._$EM(),r}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};P.elementStyles=[],P.shadowRootOptions={mode:"open"},P[Y("elementProperties")]=new Map,P[Y("finalized")]=new Map,mt?.({ReactiveElement:P}),(re.reactiveElementVersions??=[]).push("2.1.2");var ve=globalThis,Pe=s=>s,se=ve.trustedTypes,Me=se?se.createPolicy("lit-html",{createHTML:s=>s}):void 0,Ne="$lit$",R=`lit$${Math.random().toFixed(9).slice(2)}$`,Ie="?"+R,ft=`<${Ie}>`,j=document,J=()=>j.createComment(""),X=s=>s===null||typeof s!="object"&&typeof s!="function",be=Array.isArray,gt=s=>be(s)||typeof s?.[Symbol.iterator]=="function",pe=`[ 	
\f\r]`,G=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Le=/-->/g,Te=/>/g,N=RegExp(`>|${pe}(?:([^\\s"'>=/]+)(${pe}*=${pe}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),He=/'/g,Re=/"/g,je=/^(?:script|style|textarea|title)$/i,ye=s=>(t,...e)=>({_$litType$:s,strings:t,values:e}),c=ye(1),q=ye(2),Vt=ye(3),D=Symbol.for("lit-noChange"),h=Symbol.for("lit-nothing"),Ue=new WeakMap,I=j.createTreeWalker(j,129);function De(s,t){if(!be(s)||!s.hasOwnProperty("raw"))throw Error("invalid template strings array");return Me!==void 0?Me.createHTML(t):t}var vt=(s,t)=>{let e=s.length-1,r=[],o,i=t===2?"<svg>":t===3?"<math>":"",n=G;for(let d=0;d<e;d++){let p=s[d],g,y,f=-1,E=0;for(;E<p.length&&(n.lastIndex=E,y=n.exec(p),y!==null);)E=n.lastIndex,n===G?y[1]==="!--"?n=Le:y[1]!==void 0?n=Te:y[2]!==void 0?(je.test(y[2])&&(o=RegExp("</"+y[2],"g")),n=N):y[3]!==void 0&&(n=N):n===N?y[0]===">"?(n=o??G,f=-1):y[1]===void 0?f=-2:(f=n.lastIndex-y[2].length,g=y[1],n=y[3]===void 0?N:y[3]==='"'?Re:He):n===Re||n===He?n=N:n===Le||n===Te?n=G:(n=N,o=void 0);let C=n===N&&s[d+1].startsWith("/>")?" ":"";i+=n===G?p+ft:f>=0?(r.push(g),p.slice(0,f)+Ne+p.slice(f)+R+C):p+R+(f===-2?d:C)}return[De(s,i+(s[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),r]},Z=class s{constructor({strings:t,_$litType$:e},r){let o;this.parts=[];let i=0,n=0,d=t.length-1,p=this.parts,[g,y]=vt(t,e);if(this.el=s.createElement(g,r),I.currentNode=this.el.content,e===2||e===3){let f=this.el.content.firstChild;f.replaceWith(...f.childNodes)}for(;(o=I.nextNode())!==null&&p.length<d;){if(o.nodeType===1){if(o.hasAttributes())for(let f of o.getAttributeNames())if(f.endsWith(Ne)){let E=y[n++],C=o.getAttribute(f).split(R),U=/([.?@])?(.*)/.exec(E);p.push({type:1,index:i,name:U[2],strings:C,ctor:U[1]==="."?he:U[1]==="?"?me:U[1]==="@"?fe:B}),o.removeAttribute(f)}else f.startsWith(R)&&(p.push({type:6,index:i}),o.removeAttribute(f));if(je.test(o.tagName)){let f=o.textContent.split(R),E=f.length-1;if(E>0){o.textContent=se?se.emptyScript:"";for(let C=0;C<E;C++)o.append(f[C],J()),I.nextNode(),p.push({type:2,index:++i});o.append(f[E],J())}}}else if(o.nodeType===8)if(o.data===Ie)p.push({type:2,index:i});else{let f=-1;for(;(f=o.data.indexOf(R,f+1))!==-1;)p.push({type:7,index:i}),f+=R.length-1}i++}}static createElement(t,e){let r=j.createElement("template");return r.innerHTML=t,r}};function W(s,t,e=s,r){if(t===D)return t;let o=r!==void 0?e._$Co?.[r]:e._$Cl,i=X(t)?void 0:t._$litDirective$;return o?.constructor!==i&&(o?._$AO?.(!1),i===void 0?o=void 0:(o=new i(s),o._$AT(s,e,r)),r!==void 0?(e._$Co??=[])[r]=o:e._$Cl=o),o!==void 0&&(t=W(s,o._$AS(s,t.values),o,r)),t}var ue=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){let{el:{content:e},parts:r}=this._$AD,o=(t?.creationScope??j).importNode(e,!0);I.currentNode=o;let i=I.nextNode(),n=0,d=0,p=r[0];for(;p!==void 0;){if(n===p.index){let g;p.type===2?g=new Q(i,i.nextSibling,this,t):p.type===1?g=new p.ctor(i,p.name,p.strings,this,t):p.type===6&&(g=new ge(i,this,t)),this._$AV.push(g),p=r[++d]}n!==p?.index&&(i=I.nextNode(),n++)}return I.currentNode=j,o}p(t){let e=0;for(let r of this._$AV)r!==void 0&&(r.strings!==void 0?(r._$AI(t,r,e),e+=r.strings.length-2):r._$AI(t[e])),e++}},Q=class s{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,r,o){this.type=2,this._$AH=h,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=r,this.options=o,this._$Cv=o?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=W(this,t,e),X(t)?t===h||t==null||t===""?(this._$AH!==h&&this._$AR(),this._$AH=h):t!==this._$AH&&t!==D&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):gt(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==h&&X(this._$AH)?this._$AA.nextSibling.data=t:this.T(j.createTextNode(t)),this._$AH=t}$(t){let{values:e,_$litType$:r}=t,o=typeof r=="number"?this._$AC(t):(r.el===void 0&&(r.el=Z.createElement(De(r.h,r.h[0]),this.options)),r);if(this._$AH?._$AD===o)this._$AH.p(e);else{let i=new ue(o,this),n=i.u(this.options);i.p(e),this.T(n),this._$AH=i}}_$AC(t){let e=Ue.get(t.strings);return e===void 0&&Ue.set(t.strings,e=new Z(t)),e}k(t){be(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,r,o=0;for(let i of t)o===e.length?e.push(r=new s(this.O(J()),this.O(J()),this,this.options)):r=e[o],r._$AI(i),o++;o<e.length&&(this._$AR(r&&r._$AB.nextSibling,o),e.length=o)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){let r=Pe(t).nextSibling;Pe(t).remove(),t=r}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},B=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,r,o,i){this.type=1,this._$AH=h,this._$AN=void 0,this.element=t,this.name=e,this._$AM=o,this.options=i,r.length>2||r[0]!==""||r[1]!==""?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=h}_$AI(t,e=this,r,o){let i=this.strings,n=!1;if(i===void 0)t=W(this,t,e,0),n=!X(t)||t!==this._$AH&&t!==D,n&&(this._$AH=t);else{let d=t,p,g;for(t=i[0],p=0;p<i.length-1;p++)g=W(this,d[r+p],e,p),g===D&&(g=this._$AH[p]),n||=!X(g)||g!==this._$AH[p],g===h?t=h:t!==h&&(t+=(g??"")+i[p+1]),this._$AH[p]=g}n&&!o&&this.j(t)}j(t){t===h?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},he=class extends B{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===h?void 0:t}},me=class extends B{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==h)}},fe=class extends B{constructor(t,e,r,o,i){super(t,e,r,o,i),this.type=5}_$AI(t,e=this){if((t=W(this,t,e,0)??h)===D)return;let r=this._$AH,o=t===h&&r!==h||t.capture!==r.capture||t.once!==r.once||t.passive!==r.passive,i=t!==h&&(r===h||o);o&&this.element.removeEventListener(this.name,this,r),i&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},ge=class{constructor(t,e,r){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(t){W(this,t)}};var bt=ve.litHtmlPolyfillSupport;bt?.(Z,Q),(ve.litHtmlVersions??=[]).push("3.3.3");var ze=(s,t,e)=>{let r=e?.renderBefore??t,o=r._$litPart$;if(o===void 0){let i=e?.renderBefore??null;r._$litPart$=o=new Q(t.insertBefore(J(),i),i,void 0,e??{})}return o._$AI(s),o};var $e=globalThis,v=class extends P{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=ze(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return D}};v._$litElement$=!0,v.finalized=!0,$e.litElementHydrateSupport?.({LitElement:v});var yt=$e.litElementPolyfillSupport;yt?.({LitElement:v});($e.litElementVersions??=[]).push("4.2.2");var x=s=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(s,t)}):customElements.define(s,t)};var $t={attribute:!0,type:String,converter:V,reflect:!1,hasChanged:oe},xt=(s=$t,t,e)=>{let{kind:r,metadata:o}=e,i=globalThis.litPropertyMetadata.get(o);if(i===void 0&&globalThis.litPropertyMetadata.set(o,i=new Map),r==="setter"&&((s=Object.create(s)).wrapped=!0),i.set(e.name,s),r==="accessor"){let{name:n}=e;return{set(d){let p=t.get.call(this);t.set.call(this,d),this.requestUpdate(n,p,s,!0,d)},init(d){return d!==void 0&&this.C(n,void 0,s,d),d}}}if(r==="setter"){let{name:n}=e;return function(d){let p=this[n];t.call(this,d),this.requestUpdate(n,p,s,!0,d)}}throw Error("Unsupported decorator location: "+r)};function u(s){return(t,e)=>typeof e=="object"?xt(s,t,e):((r,o,i)=>{let n=o.hasOwnProperty(i);return o.constructor.createProperty(i,r),n?Object.getOwnPropertyDescriptor(o,i):void 0})(s,t,e)}function b(s){return u({...s,state:!0,attribute:!1})}var m=class extends Error{constructor(t,e){super(e),this.name="TopologyError",this.code=t}};function _t(s){if(s&&typeof s=="object"&&"code"in s){let t=s;return new m(t.code,t.message??t.code)}return new m("store_error",s instanceof Error?s.message:String(s))}var ne=class{constructor(t){this.connection=t}async send(t){try{return await this.connection.sendMessagePromise(t)}catch(e){throw _t(e)}}listAnnotations(){return this.send({type:"topology/list_annotations"})}health(){return this.send({type:"topology/health"})}neighbors(t){return this.send({type:"topology/neighbors",area_id:t})}path(t,e,r=!1){return this.send({type:"topology/path",from:t,to:e,traversable_only:r})}subscribeUpdates(t){return this.connection.subscribeMessage(t,{type:"topology/subscribe_updates"})}updateArea(t,e){return this.send({type:"topology/update_area",area_id:t,annotation:e})}upsertEdge(t,e,r){return this.send({type:"topology/upsert_edge",area_a:t,area_b:e,connections:r})}deleteEdge(t){return this.send({type:"topology/delete_edge",edge_id:t})}restoreEdge(t){return this.send({type:"topology/restore_edge",edge_id:t})}setBeyond(t,e,r){return this.send({type:"topology/set_beyond",area_id:t,side:e,beyond:r})}setExteriorConnections(t,e){return this.send({type:"topology/set_exterior_connections",area_id:t,connections:e})}setFloorLevel(t,e){return this.send({type:"topology/set_floor_level",floor_id:t,level:e})}updateHomeConfig(t){return this.send({type:"topology/update_home_config",...t})}};var ae=class{constructor(t,e={}){this.listeners=new Set;this._state={snapshot:null,health:null,connected:!0,error:null};this.unsubscribe=null;this.coalesceTimer=null;this.disposed=!1;this.client=t,this.coalesceMs=e.coalesceMs??150}get state(){return this._state}addListener(t){return this.listeners.add(t),()=>this.listeners.delete(t)}setState(t){this._state={...this._state,...t};for(let e of this.listeners)e()}async connect(){await this.reseed(),!this.disposed&&(this.unsubscribe=await this.client.subscribeUpdates(t=>this.handleUpdate(t)))}async reseed(){try{let[t,e]=await Promise.all([this.client.listAnnotations(),this.client.health()]);this.setState({snapshot:t,health:e,error:null})}catch(t){this.setState({error:t instanceof Error?t.message:String(t)})}}handleUpdate(t){this.coalesceTimer!==null&&clearTimeout(this.coalesceTimer),this.coalesceTimer=setTimeout(()=>{this.coalesceTimer=null,this.reseed()},this.coalesceMs)}handleConnectionState(t){let e=this._state.connected;this.setState({connected:t}),t&&!e&&this.reseed()}async dispose(){if(this.disposed=!0,this.coalesceTimer!==null&&(clearTimeout(this.coalesceTimer),this.coalesceTimer=null),this.unsubscribe!==null){let t=this.unsubscribe;this.unsubscribe=null,await t()}this.listeners.clear()}};var St=["unannotated","isolated","floors","bearings","exterior","orphans"],Et={unannotated:"map",isolated:"map",floors:"floors",bearings:"map",exterior:"exterior",orphans:"orphans"};function At(s){return s!==null&&St.includes(s)}function We(s){let t=s.startsWith("?")?s.slice(1):s,r=new URLSearchParams(t).get("focus");return At(r)?{view:Et[r],focus:r}:{view:"map",focus:null}}var le={"panel.title":"Topology","panel.floor.outdoor":"Outdoor / unfloored","panel.floor.switcher":"Floor","banner.reconnecting":"Reconnecting\u2026","banner.error":"Could not load topology data","map.needs_annotation":"Needs annotation","map.orphaned":"Orphaned (registry entry gone)","map.legend.trust":"Trust","map.legend.environment":"Environment","sidebar.unannotated":"Unannotated areas","sidebar.isolated":"Isolated areas","sidebar.bearings":"Contradictory bearings","sidebar.none":"Nothing flagged","editor.area.title":"Area annotation","editor.area.type":"Type","editor.area.environment":"Environment","editor.area.trust":"Trust","editor.edge.title":"Connection","editor.edge.preset":"Preset","editor.edge.add":"Add connection","editor.edge.delete":"Delete edge","editor.beyond.title":"Outer wall (beyond)","editor.exterior.title":"Exterior connections","editor.floor.title":"Floor levels","editor.floor.effective":"Effective level","editor.floor.override":"Override","editor.home.title":"Home configuration","editor.home.occupancy":"Occupancy extent","editor.home.threshold":"Unannotated repair threshold","editor.home.project_environment":"Project environment labels","editor.home.project_type":"Project type labels","editor.home.project_trust":"Project trust labels","first_run.title":"Seed annotations from Home Assistant","first_run.hint":"One-shot import from the area registry. It only fills in annotations that are still empty and never overwrites what you have set.","first_run.source.aliases":"Import area aliases","first_run.source.labels":"Import area labels","first_run.import":"Import","first_run.running":"Importing\u2026","first_run.dismiss":"Not now","editor.orphans.title":"Orphaned entries","editor.orphans.restore":"Restore","editor.orphans.empty":"No orphaned entries","action.save":"Save","action.cancel":"Cancel","action.clear":"Clear","error.not_loaded":"Topology is not loaded","error.area_not_found":"Area not found","error.edge_not_found":"Edge not found","error.floor_not_found":"Floor not found","error.invalid_enum":"Invalid value","error.invalid_connection":"Invalid connection","error.store_error":"Could not save the change","error.unauthorized":"Admin permission required"};var wt={en:le};function l(s,t={},e="en"){let o=(wt[e]??le)[s]??le[s]??s;for(let[i,n]of Object.entries(t))o=o.replace(`{${i}}`,String(n));return o}function Ct(s){let t=2166136261;for(let e=0;e<s.length;e++)t^=s.charCodeAt(e),t=Math.imul(t,16777619);return t>>>0}var Ot={width:1e3,height:700,margin:90};function Be(s,t={}){let{width:e,height:r,margin:o}={...Ot,...t},i=[...s].sort(),n=new Map,d=i.length;if(d===0)return n;let p=Math.max(1,Math.ceil(Math.sqrt(d))),g=Math.max(1,Math.ceil(d/p)),y=e-2*o,f=r-2*o,E=p>1?y/(p-1):0,C=g>1?f/(g-1):0;return i.forEach((U,Se)=>{let Qe=Se%p,et=Math.floor(Se/p),Ee=Ct(U),tt=((Ee&65535)/65535-.5)*.36,rt=((Ee>>>16&65535)/65535-.5)*.36,ot=p>1?o+Qe*E:e/2,st=g>1?o+et*C:r/2;n.set(U,{x:ot+tt*(E||y),y:st+rt*(C||f)})}),n}function qe(s){return s??"unknown"}function Fe(s){return s??"unknown"}function Ke(s){return s.type===null&&s.environment===null&&s.trust===null}var kt={open:2,door:1,solid:0},Pt={none:"",level:"",stairs:"stairs",ramp:"ramp",elevator:"elevator",ladder:"ladder",hatch:"hatch"};function Mt(s){let t=null,e=-1;for(let r of s){let o=kt[r.barrier]??0;o>e&&(e=o,t=r)}return t}function Ye(s){let t=Mt(s.connections);return t===null?{barrier:"solid",passage:"none",glyph:"",perimeter:s.is_perimeter}:{barrier:t.barrier,passage:t.passage,glyph:Pt[t.passage]??"",perimeter:s.is_perimeter}}var xe="__outdoor__",Lt={unannotated:"unannotated_areas",isolated:"isolated_areas",floors:"indoor_areas_without_floor",bearings:"contradictory_bearings",exterior:"exterior_on_non_outdoor_side"},A=class extends v{constructor(){super(...arguments);this.areas=[];this.edges=[];this.floors=[];this.health=null;this.activeFloor=null;this.focusScope=null}areaFloor(e){return this.hass?.areas?.[e]?.floor_id??xe}areaName(e,r){let o=this.hass?.areas?.[e]?.name;return o||(r.type??e)}flaggedAreas(){if(this.focusScope===null||this.health===null)return new Set;let e=Lt[this.focusScope];if(e===void 0)return new Set;let r=this.health[e];return new Set(Array.isArray(r)?r:[])}visibleAreas(){return this.activeFloor===null?this.areas:this.areas.filter(e=>this.areaFloor(e.area_id)===this.activeFloor)}render(){let e=this.visibleAreas(),r=new Set(e.map(d=>d.area_id)),o=Be(e.map(d=>d.area_id)),i=this.flaggedAreas(),n=this.edges.filter(d=>!d.orphaned_at&&r.has(d.area_a)&&r.has(d.area_b));return c`
      <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" role="img">
        <g class="edges">
          ${n.map(d=>this.renderEdge(d,o))}
        </g>
        <g class="nodes">
          ${e.map(d=>this.renderNode(d,o,i.has(d.area_id)))}
        </g>
      </svg>
    `}renderEdge(e,r){let o=r.get(e.area_a),i=r.get(e.area_b);if(!o||!i)return h;let n=Ye(e),d=`edge barrier-${n.barrier} ${n.perimeter?"perimeter":""}`;return q`
      <line
        class=${d}
        x1=${o.x} y1=${o.y} x2=${i.x} y2=${i.y}
        tabindex="0"
        @click=${()=>this.emitEdge(e)}
        @keydown=${p=>this.onKey(p,()=>this.emitEdge(e))}
      ></line>
      ${n.glyph?q`<text class="glyph" x=${(o.x+i.x)/2} y=${(o.y+i.y)/2}>${n.glyph}</text>`:h}
    `}renderNode(e,r,o){let i=r.get(e.area_id);if(!i)return h;let n=e.orphaned_at!==null,d=Ke(e),p=["node",`trust-${qe(e.trust)}`,`env-${Fe(e.environment)}`,d?"muted":"",o?"flagged":"",n?"orphaned":""].join(" "),g=150,y=64;return q`
      <g
        class=${p}
        transform="translate(${i.x-g/2}, ${i.y-y/2})"
        tabindex="0"
        @click=${()=>this.emitArea(e)}
        @keydown=${f=>this.onKey(f,()=>this.emitArea(e))}
      >
        <rect class="node-body" width=${g} height=${y} rx="10"></rect>
        <text class="node-label" x=${g/2} y=${y/2}>
          ${this.areaName(e.area_id,e)}
        </text>
        ${d?q`<title>${l("map.needs_annotation")}</title>`:h}
        ${n?q`<circle class="orphan-badge" cx=${g-8} cy="8" r="7"></circle>
                <title>${l("map.orphaned")}</title>`:h}
      </g>
    `}onKey(e,r){(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),r())}emitArea(e){this.dispatchEvent(new CustomEvent("area-selected",{detail:{area:e},bubbles:!0,composed:!0}))}emitEdge(e){this.dispatchEvent(new CustomEvent("edge-selected",{detail:{edge:e},bubbles:!0,composed:!0}))}};A.styles=$`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    svg {
      width: 100%;
      height: 100%;
      background: var(--card-background-color, #fff);
      border-radius: 12px;
    }
    .edge {
      stroke: var(--primary-text-color, #212121);
      stroke-width: 3;
      opacity: 0.8;
      cursor: pointer;
    }
    .edge:focus {
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
    .node:focus .node-body {
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
  `,a([u({attribute:!1})],A.prototype,"hass",2),a([u({attribute:!1})],A.prototype,"areas",2),a([u({attribute:!1})],A.prototype,"edges",2),a([u({attribute:!1})],A.prototype,"floors",2),a([u({attribute:!1})],A.prototype,"health",2),a([u({attribute:!1})],A.prototype,"activeFloor",2),a([u({attribute:!1})],A.prototype,"focusScope",2),A=a([x("topology-floor-map")],A);function _(s,t){let e=`error.${t.code}`,r=l(e);s.dispatchEvent(new CustomEvent("topology-toast",{detail:{message:r===e?t.message:r},bubbles:!0,composed:!0}))}var Tt=["bedroom","living","kitchen","dining","bathroom","hallway","office","utility","storage","garage","balcony","terrace","outdoor"],Ht={bedroom:{environment:"indoor",trust:"private"},living:{environment:"indoor",trust:"private"},kitchen:{environment:"indoor",trust:"private"},dining:{environment:"indoor",trust:"private"},bathroom:{environment:"indoor",trust:"private"},hallway:{environment:"indoor",trust:"shared"},office:{environment:"indoor",trust:"private"},utility:{environment:"indoor",trust:"private"},storage:{environment:"indoor",trust:"private"},garage:{environment:"indoor",trust:"private"},balcony:{environment:"semi_outdoor",trust:null},terrace:{environment:"outdoor",trust:null},outdoor:{environment:"outdoor",trust:null}},Rt=["indoor","outdoor","semi_outdoor"],Ut=["private","shared","public"],O=class extends v{constructor(){super(...arguments);this.type="";this.environment="";this.trust=""}willUpdate(e){e.has("area")&&this.area&&(this.type=this.area.type??"",this.environment=this.area.environment??"",this.trust=this.area.trust??"")}onType(e){let r=e.target.value;this.type=r;let o=Ht[r];o&&(o.environment&&(this.environment=o.environment),o.trust&&(this.trust=o.trust))}async save(){try{await this.client.updateArea(this.area.area_id,{type:this.type===""?null:this.type,environment:this.environment===""?null:this.environment,trust:this.trust===""?null:this.trust})}catch(e){_(this,e instanceof m?e:new m("store_error",String(e)))}}render(){return c`
      <div class="editor">
        <h3>${l("editor.area.title")}</h3>
        <label>
          ${l("editor.area.type")}
          <input
            list="topology-type-catalog"
            .value=${this.type}
            @change=${this.onType}
          />
          <datalist id="topology-type-catalog">
            ${Tt.map(e=>c`<option value=${e}></option>`)}
          </datalist>
        </label>
        <label>
          ${l("editor.area.environment")}
          <select
            .value=${this.environment}
            @change=${e=>{this.environment=e.target.value}}
          >
            <option value=""></option>
            ${Rt.map(e=>c`<option value=${e}>${e}</option>`)}
          </select>
        </label>
        <label>
          ${l("editor.area.trust")}
          <select
            .value=${this.trust}
            @change=${e=>{this.trust=e.target.value}}
          >
            <option value=""></option>
            ${Ut.map(e=>c`<option value=${e}>${e}</option>`)}
          </select>
        </label>
        ${this.area.orphaned_at?c`<p class="orphan">${l("map.orphaned")}</p>`:h}
        <div class="actions">
          <button class="primary" @click=${this.save}>${l("action.save")}</button>
        </div>
      </div>
    `}};O.styles=$`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
    }
    h3 {
      margin: 0;
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
    .orphan {
      color: var(--error-color, #f44336);
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
  `,a([u({attribute:!1})],O.prototype,"client",2),a([u({attribute:!1})],O.prototype,"area",2),a([b()],O.prototype,"type",2),a([b()],O.prototype,"environment",2),a([b()],O.prototype,"trust",2),O=a([x("topology-area-editor")],O);function F(s,t){let e=s.find(r=>r.preset_name===t);return e===void 0?null:{passage:e.passage,barrier:e.barrier,glazed:e.glazed_default,preset_name:e.preset_name}}var M=class extends v{constructor(){super(...arguments);this.presets=[];this.connections=[]}willUpdate(e){e.has("edge")&&this.edge&&(this.connections=this.edge.connections.map(r=>({...r})))}applyPreset(e,r){let o=F(this.presets,r);if(o===null)return;let i=[...this.connections];i[e]={...i[e],...o},this.connections=i}addConnection(){let e=this.presets[0],r=e!==void 0?F(this.presets,e.preset_name):{passage:"level",barrier:"open"};this.connections=[...this.connections,r]}removeConnection(e){this.connections=this.connections.filter((r,o)=>o!==e)}async save(){if(this.connections.length===0){await this.deleteEdge();return}try{await this.client.upsertEdge(this.edge.area_a,this.edge.area_b,this.connections)}catch(e){_(this,e instanceof m?e:new m("store_error",String(e)))}}async deleteEdge(){try{await this.client.deleteEdge(this.edge.edge_id)}catch(e){_(this,e instanceof m?e:new m("store_error",String(e)))}}render(){return c`
      <div class="editor">
        <h3>${l("editor.edge.title")}</h3>
        ${this.connections.map((e,r)=>c`
            <div class="connection">
              <label>
                ${l("editor.edge.preset")}
                <select
                  .value=${e.preset_name??""}
                  @change=${o=>this.applyPreset(r,o.target.value)}
                >
                  <option value=""></option>
                  ${this.presets.map(o=>c`<option value=${o.preset_name}>${o.preset_name}</option>`)}
                </select>
              </label>
              <span class="axes">${e.passage} / ${e.barrier}</span>
              <button @click=${()=>this.removeConnection(r)}>×</button>
            </div>
          `)}
        <div class="actions">
          <button @click=${this.addConnection}>${l("editor.edge.add")}</button>
          <button class="danger" @click=${this.deleteEdge}>
            ${l("editor.edge.delete")}
          </button>
          <button class="primary" @click=${this.save}>${l("action.save")}</button>
        </div>
      </div>
    `}};M.styles=$`
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
    .connection {
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      color: var(--secondary-text-color, #727272);
      font-size: 0.9em;
    }
    select {
      padding: 8px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .axes {
      font-family: var(--code-font-family, monospace);
      color: var(--secondary-text-color, #727272);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    button {
      padding: 8px 16px;
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
  `,a([u({attribute:!1})],M.prototype,"client",2),a([u({attribute:!1})],M.prototype,"edge",2),a([u({attribute:!1})],M.prototype,"presets",2),a([b()],M.prototype,"connections",2),M=a([x("topology-edge-editor")],M);var Nt=["N","E","S","W"],It=["outdoor","neighbor","earth"],z=class extends v{async setSide(t,e){try{await this.client.setBeyond(this.area.area_id,t,e===""?null:e)}catch(r){_(this,r instanceof m?r:new m("store_error",String(r)))}}render(){return c`
      <div class="editor">
        <h3>${l("editor.beyond.title")}</h3>
        ${Nt.map(t=>c`
            <label>
              ${t}
              <select
                .value=${this.area.beyond[t]??""}
                @change=${e=>this.setSide(t,e.target.value)}
              >
                <option value="">${l("action.clear")}</option>
                ${It.map(e=>c`<option value=${e}>${e}</option>`)}
              </select>
            </label>
          `)}
      </div>
    `}};z.styles=$`
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
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--secondary-text-color, #727272);
    }
    select {
      padding: 8px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
  `,a([u({attribute:!1})],z.prototype,"client",2),a([u({attribute:!1})],z.prototype,"area",2),z=a([x("topology-beyond-editor")],z);var jt=["private","shared","public"],k=class extends v{constructor(){super(...arguments);this.presets=[];this.flagged=!1;this.connections=[]}willUpdate(e){e.has("area")&&this.area&&(this.connections=this.area.exterior_connections.map(r=>({...r})))}addConnection(){let e=this.presets.find(o=>o.preset_name==="window")??this.presets[0],r=e!==void 0?F(this.presets,e.preset_name):{passage:"none",barrier:"door"};this.connections=[...this.connections,r]}applyPreset(e,r){let o=F(this.presets,r);if(o===null)return;let i=[...this.connections];i[e]={...i[e],...o},this.connections=i}setInlineTrust(e,r){let o=[...this.connections],i={...o[e]};r===""?delete i.inline_trust:i.inline_trust=r,o[e]=i,this.connections=o}removeConnection(e){this.connections=this.connections.filter((r,o)=>o!==e)}async save(){try{await this.client.setExteriorConnections(this.area.area_id,this.connections)}catch(e){_(this,e instanceof m?e:new m("store_error",String(e)))}}render(){return c`
      <div class="editor ${this.flagged?"flagged":""}">
        <h3>${l("editor.exterior.title")}</h3>
        ${this.connections.map((e,r)=>c`
            <div class="connection">
              <select
                .value=${e.preset_name??""}
                @change=${o=>this.applyPreset(r,o.target.value)}
              >
                <option value=""></option>
                ${this.presets.map(o=>c`<option value=${o.preset_name}>${o.preset_name}</option>`)}
              </select>
              <select
                .value=${e.inline_trust??""}
                @change=${o=>this.setInlineTrust(r,o.target.value)}
              >
                <option value="">${l("editor.area.trust")}</option>
                ${jt.map(o=>c`<option value=${o}>${o}</option>`)}
              </select>
              <button @click=${()=>this.removeConnection(r)}>×</button>
            </div>
          `)}
        <div class="actions">
          <button @click=${this.addConnection}>${l("editor.edge.add")}</button>
          <button class="primary" @click=${this.save}>${l("action.save")}</button>
        </div>
      </div>
    `}};k.styles=$`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      color: var(--primary-text-color, #212121);
      border-radius: 8px;
    }
    .editor.flagged {
      outline: 2px solid var(--error-color, #f44336);
    }
    h3 {
      margin: 0;
    }
    .connection {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    select {
      padding: 8px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    button {
      padding: 8px 16px;
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
  `,a([u({attribute:!1})],k.prototype,"client",2),a([u({attribute:!1})],k.prototype,"area",2),a([u({attribute:!1})],k.prototype,"presets",2),a([u({attribute:!1})],k.prototype,"flagged",2),a([b()],k.prototype,"connections",2),k=a([x("topology-exterior-editor")],k);var L=class extends v{constructor(){super(...arguments);this.floors=[];this.flagged=new Set}floorName(e){return this.hass?.floors?.[e]?.name??e}async setLevel(e,r){let o=r.trim()===""?null:Number.parseInt(r,10);if(!(o!==null&&Number.isNaN(o)))try{await this.client.setFloorLevel(e.floor_id,o)}catch(i){_(this,i instanceof m?i:new m("store_error",String(i)))}}render(){return c`
      <div class="editor">
        <h3>${l("editor.floor.title")}</h3>
        ${this.floors.map(e=>c`
            <div class="row ${this.flagged.has(e.floor_id)?"flagged":""}">
              <span class="name">${this.floorName(e.floor_id)}</span>
              ${e.registry_level===null?c`
                    <label>
                      ${l("editor.floor.override")}
                      <input
                        type="number"
                        .value=${e.level_override===null?"":String(e.level_override)}
                        @change=${r=>this.setLevel(e,r.target.value)}
                      />
                    </label>
                  `:c`<span class="registry">${e.registry_level}</span>`}
              <span class="effective">
                ${l("editor.floor.effective")}:
                ${e.effective_level===null?"\u2014":e.effective_level}
              </span>
            </div>
          `)}
      </div>
    `}};L.styles=$`
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
  `,a([u({attribute:!1})],L.prototype,"client",2),a([u({attribute:!1})],L.prototype,"hass",2),a([u({attribute:!1})],L.prototype,"floors",2),a([u({attribute:!1})],L.prototype,"flagged",2),L=a([x("topology-floor-editor")],L);var Ve=["aliases","labels"],Dt="topology",zt="import_from_core",Ge="topology.first-run.dismissed";function _e(s){let t=new Set;if(!s)return t;let e=null;try{e=s.getItem(Ge)}catch{return t}if(e===null)return t;let r;try{r=JSON.parse(e)}catch{return t}if(!Array.isArray(r))return t;for(let o of r)Ve.includes(o)&&t.add(o);return t}function Je(s,t){let e=_e(s);if(e.add(t),s)try{s.setItem(Ge,JSON.stringify([...e]))}catch{}return e}function Xe(s,t=new Set){return s?Ve.filter(e=>s.imports_done_at[e]===null&&!t.has(e)):[]}async function Ze(s,t){if(typeof s.callService!="function")throw new Error("hass.callService is unavailable");await s.callService(Dt,zt,{source:t})}var T=class extends v{constructor(){super(...arguments);this.dismissed=new Set;this.running=null}connectedCallback(){super.connectedCallback(),this.dismissed=_e(this.storage)}get storage(){try{return window.localStorage??null}catch{return null}}async runSource(e){this.running=e;try{await Ze(this.hass,e)}catch(r){_(this,r instanceof m?r:new m("store_error",String(r)))}finally{this.running=null}}dismissSource(e){this.dismissed=Je(this.storage,e)}render(){let e=Xe(this.homeConfig,this.dismissed);return e.length===0?h:c`
      <div class="card">
        <h3>${l("first_run.title")}</h3>
        <p class="hint">${l("first_run.hint")}</p>
        ${e.map(r=>c`
            <div class="row">
              <span class="label">${l(`first_run.source.${r}`)}</span>
              <div class="actions">
                <button
                  class="primary"
                  ?disabled=${this.running!==null}
                  @click=${()=>this.runSource(r)}
                >
                  ${this.running===r?l("first_run.running"):l("first_run.import")}
                </button>
                <button
                  class="link"
                  ?disabled=${this.running!==null}
                  @click=${()=>this.dismissSource(r)}
                >
                  ${l("first_run.dismiss")}
                </button>
              </div>
            </div>
          `)}
      </div>
    `}};T.styles=$`
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
  `,a([u({attribute:!1})],T.prototype,"hass",2),a([u({attribute:!1})],T.prototype,"homeConfig",2),a([b()],T.prototype,"dismissed",2),a([b()],T.prototype,"running",2),T=a([x("topology-first-run-card")],T);var Wt=["whole_property","unit_within_building"],w=class extends v{constructor(){super(...arguments);this.occupancy="whole_property";this.threshold=3;this.projectEnvironment=!1;this.projectType=!1;this.projectTrust=!1}willUpdate(e){e.has("homeConfig")&&this.homeConfig&&(this.occupancy=this.homeConfig.occupancy_extent,this.threshold=this.homeConfig.unannotated_repair_threshold,this.projectEnvironment=this.homeConfig.projection_toggles.environment,this.projectType=this.homeConfig.projection_toggles.type,this.projectTrust=this.homeConfig.projection_toggles.trust)}async save(){try{await this.client.updateHomeConfig({occupancy_extent:this.occupancy,unannotated_repair_threshold:this.threshold,projection_toggles:{environment:this.projectEnvironment,type:this.projectType,trust:this.projectTrust}})}catch(e){_(this,e instanceof m?e:new m("store_error",String(e)))}}render(){return c`
      <div class="editor">
        <h3>${l("editor.home.title")}</h3>
        <label>
          ${l("editor.home.occupancy")}
          <select
            .value=${this.occupancy}
            @change=${e=>{this.occupancy=e.target.value}}
          >
            ${Wt.map(e=>c`<option value=${e}>${e}</option>`)}
          </select>
        </label>
        <label>
          ${l("editor.home.threshold")}
          <input
            type="number"
            min="1"
            max="100"
            .value=${String(this.threshold)}
            @change=${e=>{this.threshold=Number.parseInt(e.target.value,10)||1}}
          />
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${this.projectEnvironment}
            @change=${e=>{this.projectEnvironment=e.target.checked}}
          />
          ${l("editor.home.project_environment")}
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${this.projectType}
            @change=${e=>{this.projectType=e.target.checked}}
          />
          ${l("editor.home.project_type")}
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${this.projectTrust}
            @change=${e=>{this.projectTrust=e.target.checked}}
          />
          ${l("editor.home.project_trust")}
        </label>
        <div class="actions">
          <button class="primary" @click=${this.save}>${l("action.save")}</button>
        </div>
      </div>
    `}};w.styles=$`
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
  `,a([u({attribute:!1})],w.prototype,"client",2),a([u({attribute:!1})],w.prototype,"homeConfig",2),a([b()],w.prototype,"occupancy",2),a([b()],w.prototype,"threshold",2),a([b()],w.prototype,"projectEnvironment",2),a([b()],w.prototype,"projectType",2),a([b()],w.prototype,"projectTrust",2),w=a([x("topology-home-config-editor")],w);var H=class extends v{constructor(){super(...arguments);this.areas=[];this.edges=[]}get orphanedAreas(){return this.areas.filter(e=>e.orphaned_at!==null)}get orphanedEdges(){return this.edges.filter(e=>e.orphaned_at!==null)}areaLabel(e){return this.hass?.areas?.[e]?.name??e}restorable(e){return!!this.hass?.areas?.[e.area_a]&&!!this.hass?.areas?.[e.area_b]}async restore(e){try{await this.client.restoreEdge(e.edge_id)}catch(r){_(this,r instanceof m?r:new m("store_error",String(r)))}}render(){let e=this.orphanedAreas,r=this.orphanedEdges;return e.length===0&&r.length===0?c`<div class="editor"><p>${l("editor.orphans.empty")}</p></div>`:c`
      <div class="editor">
        <h3>${l("editor.orphans.title")}</h3>
        ${e.map(o=>c`<div class="row"><span>${this.areaLabel(o.area_id)}</span></div>`)}
        ${r.map(o=>c`
            <div class="row">
              <span>${this.areaLabel(o.area_a)} ↔ ${this.areaLabel(o.area_b)}</span>
              <button
                ?disabled=${!this.restorable(o)}
                @click=${()=>this.restore(o)}
              >
                ${l("editor.orphans.restore")}
              </button>
            </div>
          `)}
      </div>
    `}};H.styles=$`
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
  `,a([u({attribute:!1})],H.prototype,"client",2),a([u({attribute:!1})],H.prototype,"hass",2),a([u({attribute:!1})],H.prototype,"areas",2),a([u({attribute:!1})],H.prototype,"edges",2),H=a([x("topology-orphans-view")],H);var S=class extends v{constructor(){super(...arguments);this.narrow=!1;this.store=null;this.view="map";this.focusScope=null;this.activeFloor=null;this.selectedArea=null;this.selectedEdge=null;this.toastMessage=null;this.client=null;this.removeListener=null;this.onToast=e=>{this.toastMessage=e.detail.message,window.setTimeout(()=>{this.toastMessage=null},4e3)};this.onAreaSelected=e=>{this.selectedArea=e.detail.area,this.selectedEdge=null};this.onEdgeSelected=e=>{this.selectedEdge=e.detail.edge,this.selectedArea=null}}connectedCallback(){super.connectedCallback(),this.client=new ne(this.hass.connection);let e=new ae(this.client);this.store=e,this.removeListener=e.addListener(()=>this.requestUpdate());let r=We(window.location.search);this.view=r.view,this.focusScope=r.focus,e.connect(),this.addEventListener("topology-toast",this.onToast),this.addEventListener("area-selected",this.onAreaSelected),this.addEventListener("edge-selected",this.onEdgeSelected)}disconnectedCallback(){super.disconnectedCallback(),this.removeListener?.(),this.store?.dispose(),this.removeEventListener("topology-toast",this.onToast),this.removeEventListener("area-selected",this.onAreaSelected),this.removeEventListener("edge-selected",this.onEdgeSelected)}willUpdate(e){e.has("hass")&&this.store&&this.hass&&this.store.handleConnectionState(this.hass.connection.connected??!0)}get snapshot(){return this.store?.state.snapshot??null}get health(){return this.store?.state.health??null}floorButtons(){let r=(this.snapshot?.floors??[]).map(o=>({id:o.floor_id,label:this.hass.floors?.[o.floor_id]?.name??o.floor_id}));return r.push({id:xe,label:l("panel.floor.outdoor")}),r}render(){let e=this.store?.state;return c`
      <div class="root">
        ${e&&!e.connected?c`<div class="banner reconnecting">${l("banner.reconnecting")}</div>`:h}
        ${e?.error?c`<div class="banner error">${l("banner.error")}</div>`:h}
        <header>
          <h1>${l("panel.title")}</h1>
          <nav class="floors">
            ${this.floorButtons().map(r=>c`
                <button
                  class=${this.activeFloor===r.id?"active":""}
                  @click=${()=>{this.activeFloor=r.id}}
                >
                  ${r.label}
                </button>
              `)}
          </nav>
        </header>
        <div class="body">
          <div class="map">${this.renderMap()}</div>
          <aside class="side">${this.renderSide()}</aside>
        </div>
        ${this.toastMessage?c`<div class="toast" role="alert">${this.toastMessage}</div>`:h}
      </div>
    `}renderMap(){let e=this.snapshot;return e===null?c`<div class="empty">…</div>`:c`
      <topology-floor-map
        .hass=${this.hass}
        .areas=${e.areas}
        .edges=${e.edges}
        .floors=${e.floors}
        .health=${this.health}
        .activeFloor=${this.activeFloor}
        .focusScope=${this.focusScope}
      ></topology-floor-map>
    `}renderSide(){let e=this.snapshot;if(e===null||this.client===null)return h;if(this.selectedEdge!==null)return c`
        <topology-edge-editor
          .client=${this.client}
          .edge=${this.selectedEdge}
          .presets=${e.presets}
        ></topology-edge-editor>
      `;if(this.selectedArea!==null){let r=this.focusScope==="exterior"&&(this.health?.exterior_on_non_outdoor_side??[]).includes(this.selectedArea.area_id);return c`
        <topology-area-editor .client=${this.client} .area=${this.selectedArea}></topology-area-editor>
        <topology-beyond-editor
          .client=${this.client}
          .area=${this.selectedArea}
        ></topology-beyond-editor>
        <topology-exterior-editor
          .client=${this.client}
          .area=${this.selectedArea}
          .presets=${e.presets}
          .flagged=${r}
        ></topology-exterior-editor>
      `}return this.view==="floors"?c`
        <topology-floor-editor
          .client=${this.client}
          .hass=${this.hass}
          .floors=${e.floors}
          .flagged=${new Set(this.health?.indoor_areas_without_floor??[])}
        ></topology-floor-editor>
      `:this.view==="orphans"?c`
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
    `}renderFlagged(){if(this.focusScope===null||this.health===null)return h;let e=this.focusScope==="unannotated"?"unannotated_areas":this.focusScope==="isolated"?"isolated_areas":this.focusScope==="bearings"?"contradictory_bearings":null;if(e===null)return h;let r=this.health[e],o=this.focusScope==="unannotated"?l("sidebar.unannotated"):this.focusScope==="isolated"?l("sidebar.isolated"):l("sidebar.bearings");return c`
      <div class="flagged-list">
        <h3>${o}</h3>
        ${r.length===0?c`<p>${l("sidebar.none")}</p>`:c`<ul>
              ${r.map(i=>c`<li>${this.hass.areas?.[i]?.name??i}</li>`)}
            </ul>`}
      </div>
    `}};S.styles=$`
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
    nav.floors {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    nav.floors button {
      padding: 6px 12px;
      border: none;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.2);
      color: inherit;
      cursor: pointer;
    }
    nav.floors button.active {
      background: rgba(255, 255, 255, 0.9);
      color: var(--primary-color, #03a9f4);
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
  `,a([u({attribute:!1})],S.prototype,"hass",2),a([u({attribute:!1})],S.prototype,"narrow",2),a([u({attribute:!1})],S.prototype,"route",2),a([u({attribute:!1})],S.prototype,"panel",2),a([b()],S.prototype,"store",2),a([b()],S.prototype,"view",2),a([b()],S.prototype,"focusScope",2),a([b()],S.prototype,"activeFloor",2),a([b()],S.prototype,"selectedArea",2),a([b()],S.prototype,"selectedEdge",2),a([b()],S.prototype,"toastMessage",2),S=a([x("topology-panel")],S);export{S as TopologyPanel};
//# sourceMappingURL=topology-panel.js.map
