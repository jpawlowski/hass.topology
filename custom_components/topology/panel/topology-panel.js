var At=Object.defineProperty;var kt=Object.getOwnPropertyDescriptor;var l=(i,r,e,t)=>{for(var o=t>1?void 0:t?kt(r,e):r,n=i.length-1,s;n>=0;n--)(s=i[n])&&(o=(t?s(r,e,o):s(o))||o);return t&&o&&At(r,e,o),o};var he=globalThis,me=he.ShadowRoot&&(he.ShadyCSS===void 0||he.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,ke=Symbol(),De=new WeakMap,ne=class{constructor(r,e,t){if(this._$cssResult$=!0,t!==ke)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=r,this.t=e}get styleSheet(){let r=this.o,e=this.t;if(me&&r===void 0){let t=e!==void 0&&e.length===1;t&&(r=De.get(e)),r===void 0&&((this.o=r=new CSSStyleSheet).replaceSync(this.cssText),t&&De.set(e,r))}return r}toString(){return this.cssText}},Be=i=>new ne(typeof i=="string"?i:i+"",void 0,ke),_=(i,...r)=>{let e=i.length===1?i[0]:r.reduce((t,o,n)=>t+(s=>{if(s._$cssResult$===!0)return s.cssText;if(typeof s=="number")return s;throw Error("Value passed to 'css' function must be a 'css' function result: "+s+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(o)+i[n+1],i[0]);return new ne(e,i,ke)},Fe=(i,r)=>{if(me)i.adoptedStyleSheets=r.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let e of r){let t=document.createElement("style"),o=he.litNonce;o!==void 0&&t.setAttribute("nonce",o),t.textContent=e.cssText,i.appendChild(t)}},Oe=me?i=>i:i=>i instanceof CSSStyleSheet?(r=>{let e="";for(let t of r.cssRules)e+=t.cssText;return Be(e)})(i):i;var{is:Ot,defineProperty:Ct,getOwnPropertyDescriptor:Pt,getOwnPropertyNames:It,getOwnPropertySymbols:Lt,getPrototypeOf:Tt}=Object,fe=globalThis,Ve=fe.trustedTypes,Ht=Ve?Ve.emptyScript:"",Mt=fe.reactiveElementPolyfillSupport,se=(i,r)=>i,ae={toAttribute(i,r){switch(r){case Boolean:i=i?Ht:null;break;case Object:case Array:i=i==null?i:JSON.stringify(i)}return i},fromAttribute(i,r){let e=i;switch(r){case Boolean:e=i!==null;break;case Number:e=i===null?null:Number(i);break;case Object:case Array:try{e=JSON.parse(i)}catch{e=null}}return e}},ge=(i,r)=>!Ot(i,r),qe={attribute:!0,type:String,converter:ae,reflect:!1,useDefault:!1,hasChanged:ge};Symbol.metadata??=Symbol("metadata"),fe.litPropertyMetadata??=new WeakMap;var U=class extends HTMLElement{static addInitializer(r){this._$Ei(),(this.l??=[]).push(r)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(r,e=qe){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(r)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(r,e),!e.noAccessor){let t=Symbol(),o=this.getPropertyDescriptor(r,t,e);o!==void 0&&Ct(this.prototype,r,o)}}static getPropertyDescriptor(r,e,t){let{get:o,set:n}=Pt(this.prototype,r)??{get(){return this[e]},set(s){this[e]=s}};return{get:o,set(s){let d=o?.call(this);n?.call(this,s),this.requestUpdate(r,d,t)},configurable:!0,enumerable:!0}}static getPropertyOptions(r){return this.elementProperties.get(r)??qe}static _$Ei(){if(this.hasOwnProperty(se("elementProperties")))return;let r=Tt(this);r.finalize(),r.l!==void 0&&(this.l=[...r.l]),this.elementProperties=new Map(r.elementProperties)}static finalize(){if(this.hasOwnProperty(se("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(se("properties"))){let e=this.properties,t=[...It(e),...Lt(e)];for(let o of t)this.createProperty(o,e[o])}let r=this[Symbol.metadata];if(r!==null){let e=litPropertyMetadata.get(r);if(e!==void 0)for(let[t,o]of e)this.elementProperties.set(t,o)}this._$Eh=new Map;for(let[e,t]of this.elementProperties){let o=this._$Eu(e,t);o!==void 0&&this._$Eh.set(o,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(r){let e=[];if(Array.isArray(r)){let t=new Set(r.flat(1/0).reverse());for(let o of t)e.unshift(Oe(o))}else r!==void 0&&e.push(Oe(r));return e}static _$Eu(r,e){let t=e.attribute;return t===!1?void 0:typeof t=="string"?t:typeof r=="string"?r.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(r=>this.enableUpdating=r),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(r=>r(this))}addController(r){(this._$EO??=new Set).add(r),this.renderRoot!==void 0&&this.isConnected&&r.hostConnected?.()}removeController(r){this._$EO?.delete(r)}_$E_(){let r=new Map,e=this.constructor.elementProperties;for(let t of e.keys())this.hasOwnProperty(t)&&(r.set(t,this[t]),delete this[t]);r.size>0&&(this._$Ep=r)}createRenderRoot(){let r=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Fe(r,this.constructor.elementStyles),r}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(r=>r.hostConnected?.())}enableUpdating(r){}disconnectedCallback(){this._$EO?.forEach(r=>r.hostDisconnected?.())}attributeChangedCallback(r,e,t){this._$AK(r,t)}_$ET(r,e){let t=this.constructor.elementProperties.get(r),o=this.constructor._$Eu(r,t);if(o!==void 0&&t.reflect===!0){let n=(t.converter?.toAttribute!==void 0?t.converter:ae).toAttribute(e,t.type);this._$Em=r,n==null?this.removeAttribute(o):this.setAttribute(o,n),this._$Em=null}}_$AK(r,e){let t=this.constructor,o=t._$Eh.get(r);if(o!==void 0&&this._$Em!==o){let n=t.getPropertyOptions(o),s=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:ae;this._$Em=o;let d=s.fromAttribute(e,n.type);this[o]=d??this._$Ej?.get(o)??d,this._$Em=null}}requestUpdate(r,e,t,o=!1,n){if(r!==void 0){let s=this.constructor;if(o===!1&&(n=this[r]),t??=s.getPropertyOptions(r),!((t.hasChanged??ge)(n,e)||t.useDefault&&t.reflect&&n===this._$Ej?.get(r)&&!this.hasAttribute(s._$Eu(r,t))))return;this.C(r,e,t)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(r,e,{useDefault:t,reflect:o,wrapped:n},s){t&&!(this._$Ej??=new Map).has(r)&&(this._$Ej.set(r,s??e??this[r]),n!==!0||s!==void 0)||(this._$AL.has(r)||(this.hasUpdated||t||(e=void 0),this._$AL.set(r,e)),o===!0&&this._$Em!==r&&(this._$Eq??=new Set).add(r))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let r=this.scheduleUpdate();return r!=null&&await r,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[o,n]of this._$Ep)this[o]=n;this._$Ep=void 0}let t=this.constructor.elementProperties;if(t.size>0)for(let[o,n]of t){let{wrapped:s}=n,d=this[o];s!==!0||this._$AL.has(o)||d===void 0||this.C(o,void 0,n,d)}}let r=!1,e=this._$AL;try{r=this.shouldUpdate(e),r?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(t){throw r=!1,this._$EM(),t}r&&this._$AE(e)}willUpdate(r){}_$AE(r){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(r)),this.updated(r)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(r){return!0}update(r){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(r){}firstUpdated(r){}};U.elementStyles=[],U.shadowRootOptions={mode:"open"},U[se("elementProperties")]=new Map,U[se("finalized")]=new Map,Mt?.({ReactiveElement:U}),(fe.reactiveElementVersions??=[]).push("2.1.2");var Pe=globalThis,Ge=i=>i,ve=Pe.trustedTypes,Ke=ve?ve.createPolicy("lit-html",{createHTML:i=>i}):void 0,Ie="$lit$",j=`lit$${Math.random().toFixed(9).slice(2)}$`,Le="?"+j,Rt=`<${Le}>`,K=document,ce=()=>K.createComment(""),de=i=>i===null||typeof i!="object"&&typeof i!="function",Te=Array.isArray,et=i=>Te(i)||typeof i?.[Symbol.iterator]=="function",Ce=`[ 	
\f\r]`,le=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Ye=/-->/g,Xe=/>/g,q=RegExp(`>|${Ce}(?:([^\\s"'>=/]+)(${Ce}*=${Ce}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Je=/'/g,Qe=/"/g,tt=/^(?:script|style|textarea|title)$/i,He=i=>(r,...e)=>({_$litType$:i,strings:r,values:e}),c=He(1),B=He(2),br=He(3),I=Symbol.for("lit-noChange"),h=Symbol.for("lit-nothing"),Ze=new WeakMap,G=K.createTreeWalker(K,129);function rt(i,r){if(!Te(i)||!i.hasOwnProperty("raw"))throw Error("invalid template strings array");return Ke!==void 0?Ke.createHTML(r):r}var ot=(i,r)=>{let e=i.length-1,t=[],o,n=r===2?"<svg>":r===3?"<math>":"",s=le;for(let d=0;d<e;d++){let p=i[d],m,b,f=-1,y=0;for(;y<p.length&&(s.lastIndex=y,b=s.exec(p),b!==null);)y=s.lastIndex,s===le?b[1]==="!--"?s=Ye:b[1]!==void 0?s=Xe:b[2]!==void 0?(tt.test(b[2])&&(o=RegExp("</"+b[2],"g")),s=q):b[3]!==void 0&&(s=q):s===q?b[0]===">"?(s=o??le,f=-1):b[1]===void 0?f=-2:(f=s.lastIndex-b[2].length,m=b[1],s=b[3]===void 0?q:b[3]==='"'?Qe:Je):s===Qe||s===Je?s=q:s===Ye||s===Xe?s=le:(s=q,o=void 0);let x=s===q&&i[d+1].startsWith("/>")?" ":"";n+=s===le?p+Rt:f>=0?(t.push(m),p.slice(0,f)+Ie+p.slice(f)+j+x):p+j+(f===-2?d:x)}return[rt(i,n+(i[e]||"<?>")+(r===2?"</svg>":r===3?"</math>":"")),t]},pe=class i{constructor({strings:r,_$litType$:e},t){let o;this.parts=[];let n=0,s=0,d=r.length-1,p=this.parts,[m,b]=ot(r,e);if(this.el=i.createElement(m,t),G.currentNode=this.el.content,e===2||e===3){let f=this.el.content.firstChild;f.replaceWith(...f.childNodes)}for(;(o=G.nextNode())!==null&&p.length<d;){if(o.nodeType===1){if(o.hasAttributes())for(let f of o.getAttributeNames())if(f.endsWith(Ie)){let y=b[s++],x=o.getAttribute(f).split(j),P=/([.?@])?(.*)/.exec(y);p.push({type:1,index:n,name:P[2],strings:x,ctor:P[1]==="."?ye:P[1]==="?"?$e:P[1]==="@"?xe:X}),o.removeAttribute(f)}else f.startsWith(j)&&(p.push({type:6,index:n}),o.removeAttribute(f));if(tt.test(o.tagName)){let f=o.textContent.split(j),y=f.length-1;if(y>0){o.textContent=ve?ve.emptyScript:"";for(let x=0;x<y;x++)o.append(f[x],ce()),G.nextNode(),p.push({type:2,index:++n});o.append(f[y],ce())}}}else if(o.nodeType===8)if(o.data===Le)p.push({type:2,index:n});else{let f=-1;for(;(f=o.data.indexOf(j,f+1))!==-1;)p.push({type:7,index:n}),f+=j.length-1}n++}}static createElement(r,e){let t=K.createElement("template");return t.innerHTML=r,t}};function Y(i,r,e=i,t){if(r===I)return r;let o=t!==void 0?e._$Co?.[t]:e._$Cl,n=de(r)?void 0:r._$litDirective$;return o?.constructor!==n&&(o?._$AO?.(!1),n===void 0?o=void 0:(o=new n(i),o._$AT(i,e,t)),t!==void 0?(e._$Co??=[])[t]=o:e._$Cl=o),o!==void 0&&(r=Y(i,o._$AS(i,r.values),o,t)),r}var be=class{constructor(r,e){this._$AV=[],this._$AN=void 0,this._$AD=r,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(r){let{el:{content:e},parts:t}=this._$AD,o=(r?.creationScope??K).importNode(e,!0);G.currentNode=o;let n=G.nextNode(),s=0,d=0,p=t[0];for(;p!==void 0;){if(s===p.index){let m;p.type===2?m=new re(n,n.nextSibling,this,r):p.type===1?m=new p.ctor(n,p.name,p.strings,this,r):p.type===6&&(m=new _e(n,this,r)),this._$AV.push(m),p=t[++d]}s!==p?.index&&(n=G.nextNode(),s++)}return G.currentNode=K,o}p(r){let e=0;for(let t of this._$AV)t!==void 0&&(t.strings!==void 0?(t._$AI(r,t,e),e+=t.strings.length-2):t._$AI(r[e])),e++}},re=class i{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(r,e,t,o){this.type=2,this._$AH=h,this._$AN=void 0,this._$AA=r,this._$AB=e,this._$AM=t,this.options=o,this._$Cv=o?.isConnected??!0}get parentNode(){let r=this._$AA.parentNode,e=this._$AM;return e!==void 0&&r?.nodeType===11&&(r=e.parentNode),r}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(r,e=this){r=Y(this,r,e),de(r)?r===h||r==null||r===""?(this._$AH!==h&&this._$AR(),this._$AH=h):r!==this._$AH&&r!==I&&this._(r):r._$litType$!==void 0?this.$(r):r.nodeType!==void 0?this.T(r):et(r)?this.k(r):this._(r)}O(r){return this._$AA.parentNode.insertBefore(r,this._$AB)}T(r){this._$AH!==r&&(this._$AR(),this._$AH=this.O(r))}_(r){this._$AH!==h&&de(this._$AH)?this._$AA.nextSibling.data=r:this.T(K.createTextNode(r)),this._$AH=r}$(r){let{values:e,_$litType$:t}=r,o=typeof t=="number"?this._$AC(r):(t.el===void 0&&(t.el=pe.createElement(rt(t.h,t.h[0]),this.options)),t);if(this._$AH?._$AD===o)this._$AH.p(e);else{let n=new be(o,this),s=n.u(this.options);n.p(e),this.T(s),this._$AH=n}}_$AC(r){let e=Ze.get(r.strings);return e===void 0&&Ze.set(r.strings,e=new pe(r)),e}k(r){Te(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,t,o=0;for(let n of r)o===e.length?e.push(t=new i(this.O(ce()),this.O(ce()),this,this.options)):t=e[o],t._$AI(n),o++;o<e.length&&(this._$AR(t&&t._$AB.nextSibling,o),e.length=o)}_$AR(r=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);r!==this._$AB;){let t=Ge(r).nextSibling;Ge(r).remove(),r=t}}setConnected(r){this._$AM===void 0&&(this._$Cv=r,this._$AP?.(r))}},X=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(r,e,t,o,n){this.type=1,this._$AH=h,this._$AN=void 0,this.element=r,this.name=e,this._$AM=o,this.options=n,t.length>2||t[0]!==""||t[1]!==""?(this._$AH=Array(t.length-1).fill(new String),this.strings=t):this._$AH=h}_$AI(r,e=this,t,o){let n=this.strings,s=!1;if(n===void 0)r=Y(this,r,e,0),s=!de(r)||r!==this._$AH&&r!==I,s&&(this._$AH=r);else{let d=r,p,m;for(r=n[0],p=0;p<n.length-1;p++)m=Y(this,d[t+p],e,p),m===I&&(m=this._$AH[p]),s||=!de(m)||m!==this._$AH[p],m===h?r=h:r!==h&&(r+=(m??"")+n[p+1]),this._$AH[p]=m}s&&!o&&this.j(r)}j(r){r===h?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,r??"")}},ye=class extends X{constructor(){super(...arguments),this.type=3}j(r){this.element[this.name]=r===h?void 0:r}},$e=class extends X{constructor(){super(...arguments),this.type=4}j(r){this.element.toggleAttribute(this.name,!!r&&r!==h)}},xe=class extends X{constructor(r,e,t,o,n){super(r,e,t,o,n),this.type=5}_$AI(r,e=this){if((r=Y(this,r,e,0)??h)===I)return;let t=this._$AH,o=r===h&&t!==h||r.capture!==t.capture||r.once!==t.once||r.passive!==t.passive,n=r!==h&&(t===h||o);o&&this.element.removeEventListener(this.name,this,t),n&&this.element.addEventListener(this.name,this,r),this._$AH=r}handleEvent(r){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,r):this._$AH.handleEvent(r)}},_e=class{constructor(r,e,t){this.element=r,this.type=6,this._$AN=void 0,this._$AM=e,this.options=t}get _$AU(){return this._$AM._$AU}_$AI(r){Y(this,r)}},it={M:Ie,P:j,A:Le,C:1,L:ot,R:be,D:et,V:Y,I:re,H:X,N:$e,U:xe,B:ye,F:_e},Nt=Pe.litHtmlPolyfillSupport;Nt?.(pe,re),(Pe.litHtmlVersions??=[]).push("3.3.3");var nt=(i,r,e)=>{let t=e?.renderBefore??r,o=t._$litPart$;if(o===void 0){let n=e?.renderBefore??null;t._$litPart$=o=new re(r.insertBefore(ce(),n),n,void 0,e??{})}return o._$AI(i),o};var Me=globalThis,$=class extends U{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let r=super.createRenderRoot();return this.renderOptions.renderBefore??=r.firstChild,r}update(r){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(r),this._$Do=nt(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return I}};$._$litElement$=!0,$.finalized=!0,Me.litElementHydrateSupport?.({LitElement:$});var Ut=Me.litElementPolyfillSupport;Ut?.({LitElement:$});(Me.litElementVersions??=[]).push("4.2.2");var S=i=>(r,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(i,r)}):customElements.define(i,r)};var jt={attribute:!0,type:String,converter:ae,reflect:!1,hasChanged:ge},zt=(i=jt,r,e)=>{let{kind:t,metadata:o}=e,n=globalThis.litPropertyMetadata.get(o);if(n===void 0&&globalThis.litPropertyMetadata.set(o,n=new Map),t==="setter"&&((i=Object.create(i)).wrapped=!0),n.set(e.name,i),t==="accessor"){let{name:s}=e;return{set(d){let p=r.get.call(this);r.set.call(this,d),this.requestUpdate(s,p,i,!0,d)},init(d){return d!==void 0&&this.C(s,void 0,i,d),d}}}if(t==="setter"){let{name:s}=e;return function(d){let p=this[s];r.call(this,d),this.requestUpdate(s,p,i,!0,d)}}throw Error("Unsupported decorator location: "+t)};function u(i){return(r,e)=>typeof e=="object"?zt(i,r,e):((t,o,n)=>{let s=o.hasOwnProperty(n);return o.constructor.createProperty(n,t),s?Object.getOwnPropertyDescriptor(o,n):void 0})(i,r,e)}function v(i){return u({...i,state:!0,attribute:!1})}var g=class extends Error{constructor(r,e){super(e),this.name="TopologyError",this.code=r}};function Wt(i){if(i&&typeof i=="object"&&"code"in i){let r=i;return new g(r.code,r.message??r.code)}return new g("store_error",i instanceof Error?i.message:String(i))}var Ee=class{constructor(r){this.connection=r}async send(r){try{return await this.connection.sendMessagePromise(r)}catch(e){throw Wt(e)}}listAnnotations(){return this.send({type:"topology/list_annotations"})}health(){return this.send({type:"topology/health"})}neighbors(r){return this.send({type:"topology/neighbors",area_id:r})}path(r,e,t=!1){return this.send({type:"topology/path",from:r,to:e,traversable_only:t})}subscribeUpdates(r){return this.connection.subscribeMessage(r,{type:"topology/subscribe_updates"})}updateArea(r,e){return this.send({type:"topology/update_area",area_id:r,annotation:e})}upsertEdge(r,e,t){return this.send({type:"topology/upsert_edge",area_a:r,area_b:e,connections:t})}deleteEdge(r){return this.send({type:"topology/delete_edge",edge_id:r})}restoreEdge(r){return this.send({type:"topology/restore_edge",edge_id:r})}setBeyond(r,e,t){return this.send({type:"topology/set_beyond",area_id:r,side:e,beyond:t})}setExteriorConnections(r,e){return this.send({type:"topology/set_exterior_connections",area_id:r,connections:e})}setFloorLevel(r,e){return this.send({type:"topology/set_floor_level",floor_id:r,level:e})}updateHomeConfig(r){return this.send({type:"topology/update_home_config",...r})}};var Se=class{constructor(r,e={}){this.listeners=new Set;this._state={snapshot:null,health:null,connected:!0,error:null};this.unsubscribe=null;this.coalesceTimer=null;this.disposed=!1;this.client=r,this.coalesceMs=e.coalesceMs??150}get state(){return this._state}addListener(r){return this.listeners.add(r),()=>this.listeners.delete(r)}setState(r){this._state={...this._state,...r};for(let e of this.listeners)e()}async connect(){await this.reseed(),!this.disposed&&(this.unsubscribe=await this.client.subscribeUpdates(r=>this.handleUpdate(r)))}async reseed(){try{let[r,e]=await Promise.all([this.client.listAnnotations(),this.client.health()]);this.setState({snapshot:r,health:e,error:null})}catch(r){this.setState({error:r instanceof Error?r.message:String(r)})}}handleUpdate(r){this.coalesceTimer!==null&&clearTimeout(this.coalesceTimer),this.coalesceTimer=setTimeout(()=>{this.coalesceTimer=null,this.reseed()},this.coalesceMs)}handleConnectionState(r){let e=this._state.connected;this.setState({connected:r}),r&&!e&&this.reseed()}async dispose(){if(this.disposed=!0,this.coalesceTimer!==null&&(clearTimeout(this.coalesceTimer),this.coalesceTimer=null),this.unsubscribe!==null){let r=this.unsubscribe;this.unsubscribe=null,await r()}this.listeners.clear()}};var Dt=["unannotated","isolated","floors","bearings","exterior","geometry","orphans"],Bt={unannotated:"map",isolated:"map",floors:"floors",bearings:"map",exterior:"map",geometry:"map",orphans:"orphans"};function st(i){return i===null?"":`?focus=${i}`}function Ft(i){return i!==null&&Dt.includes(i)}function at(i){let r=i.startsWith("?")?i.slice(1):i,t=new URLSearchParams(r).get("focus");return Ft(t)?{view:Bt[t],focus:t}:{view:"map",focus:null}}var oe={"panel.title":"Topology","panel.floor.outdoor":"Outdoor / unfloored","panel.floor.all":"All floors","panel.floor.switcher":"Floor","panel.nav.home":"Home configuration","panel.nav.floors":"Floor levels","panel.nav.orphans":"Orphaned entries","panel.nav.back":"Back to home configuration","banner.reconnecting":"Reconnecting\u2026","banner.error":"Could not load topology data","map.needs_annotation":"Needs annotation","map.orphaned":"Orphaned (registry entry gone)","map.legend.trust":"Trust","map.legend.environment":"Environment","map.hint":"Drag to pan, scroll to zoom, double-click to reset.","map.reset_view":"Reset view","map.empty":"No areas to show. Create areas in Home Assistant first.","map.band.unfloored":"No floor","map.offfloor":"{count} connection(s) lead to another floor.","map.connector.up":"{area} \xB7 {floor} (above)","map.connector.down":"{area} \xB7 {floor} (below)","map.connector.unknown":"{area} \xB7 {floor} (no floor level)","map.connector.hint":"click to open the connection, double-click to go to that floor","sidebar.unannotated":"Unannotated areas","sidebar.isolated":"Isolated areas","sidebar.bearings":"Contradictory bearings","sidebar.spanning":"Connections spanning several floors","sidebar.no_climb":"Connections between floors with no way to climb","sidebar.none":"Nothing flagged","editor.area.title":"Area annotation","editor.area.type":"Type","editor.area.type.hint":"A shortcut, not a setting: picking a type fills in Environment and Trust below, which are the values automations actually read. Change them freely afterwards \u2014 and leave Type empty if none fits.","editor.area.type.custom":"Custom type\u2026","editor.area.type.custom_label":"Custom type","editor.area.environment":"Environment","editor.area.environment.hint":"Whether this space is enclosed, open to the weather, or in between.","editor.area.trust":"Trust","editor.area.trust.hint":"How exposed the space is to people: private (household only), shared (guests, other tenants), public (anyone). A boundary where this changes becomes part of the perimeter.","editor.area.unsaved":"Unsaved changes","editor.edge.title":"Connection","editor.edge.preset":"Kind","editor.edge.add":"Add connection","editor.edge.delete":"Delete connection","editor.edge.between":"{a} \u2194 {b}","editor.edge.axis.horizontal":"Same floor","editor.edge.axis.vertical_up":"{b} is {levels} floor(s) above {a}","editor.edge.axis.vertical_down":"{b} is {levels} floor(s) below {a}","editor.edge.axis.unknown":"Floor relationship unknown (assign both areas to a floor)","editor.edge.hint":"A boundary can carry several ways across \u2014 a stair and a lift beside it are two entries here.","editor.neighbors.title":"Neighbours","editor.neighbors.hint":"Which areas this one physically borders. This is what makes the adjacency graph \u2014 automations use it to reason about rooms next to, above, and below each other.","editor.neighbors.none":"No neighbours declared yet","editor.neighbors.add":"Add neighbour","editor.neighbors.area":"Area","editor.neighbors.pick":"Choose an area\u2026","editor.neighbors.group.same":"Same floor","editor.neighbors.group.above":"Floor above","editor.neighbors.group.below":"Floor below","editor.neighbors.group.distant":"Other floors (unusual)","editor.neighbors.group.unknown":"No floor assigned","editor.neighbors.distant_warning":"These areas are more than one floor apart, so they rarely share a boundary. Check the floor assignments if that is unexpected.","editor.neighbors.edit":"Edit","editor.beyond.title":"Outer walls","editor.beyond.hint":"For each side that is NOT shared with another one of your areas, say what is on the other side. This is what makes a wall count as exterior, and it decides where a window can sit.","editor.beyond.interior":"Interior wall \u2014 borders {areas}","editor.beyond.unset":"Not specified","editor.beyond.suggest":"Set to {value}, based on your occupancy extent","editor.exterior.title":"Windows & outside doors","editor.exterior.hint":"Openings that leave your home entirely. Set the side each one faces \u2014 without it the opening cannot be matched against the outer wall it sits in, so nothing can use it.","editor.exterior.none":"No windows or outside doors declared","editor.exterior.sideless":"An opening without a side cannot be matched to the outer wall it sits in, so nothing will use it. Pick a side for each one.","editor.exterior.outer_sides":"Outer walls declared for this area: {sides}.","editor.exterior.beyond_trust":"Trust beyond","editor.exterior.beyond_trust.hint":"Who can reach the far side. Left empty it counts as public, which makes the opening part of the perimeter.","editor.connection.side":"Side","editor.connection.side.hint":"Rough compass bearing of the wall this sits in.","editor.connection.glazed":"Glazed (lets daylight through)","editor.connection.sensor":"Open/close sensor","editor.connection.sensor.hint":"Bind a binary sensor to make this opening observable. Only bound openings can turn the perimeter sensor on.","editor.connection.sensor.none":"Not bound","editor.connection.sensor.unavailable":"Only a door-type kind can carry a sensor","editor.connection.override":"Always treat as perimeter","editor.connection.override.hint":"Force this boundary into the perimeter even when both sides share the same trust class \u2014 for example the door between a main flat and an annexe.","editor.floor.title":"Floor levels","editor.floor.hint":"Levels come from Home Assistant and only say what sits above what \u2014 0 is a perfectly normal ground floor. Topology can fill in a level for a floor that has none; a level set in Home Assistant always wins.","editor.floor.effective":"Effective level","editor.floor.override":"Override","editor.floor.from_registry":"From Home Assistant","editor.floor.unset":"No level set","editor.home.title":"Home configuration","editor.home.occupancy":"Occupancy extent","editor.home.occupancy.hint":"Whether you model a whole property or one unit inside a larger building. Recorded for consumers; it does not change any derivation.","editor.home.threshold":"Unannotated repair threshold","editor.home.threshold.hint":"Raise a repair notice once at least this many areas are still unannotated.","editor.home.projection":"Label projection","editor.home.projection.hint":"Mirror annotations onto Home Assistant areas as `topology:<dimension>:<value>` labels so automations can target them directly.","editor.home.project_environment":"Project environment labels","editor.home.project_type":"Project type labels","editor.home.project_trust":"Project trust labels","first_run.title":"Seed annotations from Home Assistant","first_run.hint":"One-shot import from the area registry. It only fills in annotations that are still empty and never overwrites what you have set.","first_run.source.aliases":"Import area aliases","first_run.source.labels":"Import area labels","first_run.import":"Import","first_run.running":"Importing\u2026","first_run.dismiss":"Not now","editor.orphans.title":"Orphaned entries","editor.orphans.restore":"Restore","editor.orphans.empty":"No orphaned entries","action.save":"Save","action.cancel":"Cancel","action.clear":"Clear","action.add":"Add","action.remove":"Remove","action.close":"Close","enum.environment.indoor":"Indoor","enum.environment.outdoor":"Outdoor","enum.environment.semi_outdoor":"Semi-outdoor","enum.trust.private":"Private","enum.trust.shared":"Shared","enum.trust.public":"Public","enum.beyond.outdoor":"Open air","enum.beyond.neighbor":"Neighbouring unit","enum.beyond.earth":"Earth (buried)","enum.side.N":"North","enum.side.E":"East","enum.side.S":"South","enum.side.W":"West","enum.passage.none":"No way through","enum.passage.level":"Step-free","enum.passage.stairs":"Stairs","enum.passage.ramp":"Ramp","enum.passage.elevator":"Lift","enum.passage.ladder":"Ladder","enum.passage.hatch":"Hatch","enum.barrier.open":"Open","enum.barrier.door":"Door","enum.barrier.solid":"Solid","enum.preset.interior_door":"Interior door","enum.preset.open_passage":"Open passage","enum.preset.shared_wall":"Shared wall","enum.preset.ceiling":"Floor / ceiling slab","enum.preset.open_stair":"Open stair","enum.preset.enclosed_stair":"Enclosed stair","enum.preset.lift":"Lift","enum.preset.loft_ladder":"Loft ladder","enum.preset.ramp":"Ramp","enum.preset.hatch":"Hatch","enum.preset.window":"Window","enum.preset.outside_door":"Outside door","enum.occupancy.whole_property":"Whole property","enum.occupancy.unit_within_building":"Unit within a building","enum.type.bedroom":"Bedroom","enum.type.living":"Living room","enum.type.kitchen":"Kitchen","enum.type.dining":"Dining room","enum.type.bathroom":"Bathroom","enum.type.hallway":"Hallway","enum.type.office":"Office","enum.type.utility":"Utility room","enum.type.storage":"Storage","enum.type.garage":"Garage","enum.type.balcony":"Balcony","enum.type.terrace":"Terrace","enum.type.outdoor":"Outdoors","error.not_loaded":"Topology is not loaded","error.area_not_found":"Area not found","error.edge_not_found":"Edge not found","error.floor_not_found":"Floor not found","error.invalid_enum":"Invalid value","error.invalid_connection":"Invalid connection","error.store_error":"Could not save the change","error.unauthorized":"Admin permission required"};var lt={en:oe};function a(i,r={},e="en"){let o=(lt[e]??oe)[i]??oe[i]??i;for(let[n,s]of Object.entries(r))o=o.replace(`{${n}}`,String(s));return o}function w(i,r,e="en"){let t=`enum.${i}.${r}`;return(lt[e]??oe)[t]??oe[t]??r}var Vt={nodeWidth:150,nodeHeight:64,gapX:32,rowGap:24,bandGap:56,padding:40,maxColumns:5};function ct(i,r){if(i.length===0)return[];let e=Math.min(i.length,Math.max(1,r)),t=[];for(let o=0;o<i.length;o+=e)t.push(i.slice(o,o+e));return t}function Re(i,r=[],e={}){let t={...Vt,...e},o=new Map,n=[];if(i.length===0)return{positions:o,bands:n,extent:{x:0,y:0,width:t.nodeWidth,height:t.nodeHeight}};let s=new Map;for(let x of i){let P=x.floorId,V=s.get(P);V===void 0?s.set(P,[x]):V.push(x)}let d=[];for(let x of r)s.has(x)&&d.push(x);for(let x of s.keys())d.includes(x)||d.push(x);let p=1;for(let x of d)for(let P of ct(s.get(x)??[],t.maxColumns))p=Math.max(p,P.length);let m=p*t.nodeWidth+(p-1)*t.gapX,b=t.padding+m/2,f=t.padding;for(let x of d){let P=ct(s.get(x)??[],t.maxColumns),V=f;for(let ee of P){let ue=ee.length*t.nodeWidth+(ee.length-1)*t.gapX,te=b-ue/2;for(let St of ee)o.set(St.areaId,{x:te+t.nodeWidth/2,y:f+t.nodeHeight/2}),te+=t.nodeWidth+t.gapX;f+=t.nodeHeight+t.rowGap}f=f-t.rowGap+t.bandGap,n.push({floorId:x,y:V,height:f-t.bandGap-V})}let y=f-t.bandGap+t.padding;return{positions:o,bands:n,extent:{x:0,y:0,width:m+2*t.padding,height:y}}}function dt(i){return i??"unknown"}function pt(i){return i??"unknown"}function ut(i){return i.type===null&&i.environment===null&&i.trust===null}var qt={open:2,door:1,solid:0},Gt={none:"",level:"",stairs:"stairs",ramp:"ramp",elevator:"elevator",ladder:"ladder",hatch:"hatch"};function Kt(i){let r=null,e=-1;for(let t of i){let o=qt[t.barrier]??0;o>e&&(e=o,r=t)}return r}function Ne(i){let r=Kt(i.connections);return r===null?{barrier:"solid",passage:"none",glyph:"",perimeter:i.is_perimeter}:{barrier:r.barrier,passage:r.passage,glyph:Gt[r.passage]??"",perimeter:i.is_perimeter}}var ie="__outdoor__",Yt={unannotated:"unannotated_areas",isolated:"isolated_areas",floors:"indoor_areas_without_floor",bearings:"contradictory_bearings",exterior:"exterior_on_non_outdoor_side"},J=150,Q=64,Xt=.4,Jt=4,ht=30,O=class extends ${constructor(){super(...arguments);this.areas=[];this.edges=[];this.floors=[];this.health=null;this.activeFloor=null;this.focusScope=null;this.selectedAreaId=null;this.selectedEdgeId=null;this.viewOverride=null;this.panStart=null;this.onWheel=e=>{e.preventDefault();let t=this.currentView(),o=this.contentExtent(),n=e.deltaY>0?1.15:1/1.15,s=t.width*n;if(o.width/s<Xt||o.width/s>Jt)return;let d=t.height*n,{x:p,y:m}=this.toSvgPoint(e,t);this.viewOverride={x:p-(p-t.x)*s/t.width,y:m-(m-t.y)*d/t.height,width:s,height:d}};this.onPointerDown=e=>{if(e.target.closest(".node, .edge")!==null)return;let t=this.currentView();this.panStart={pointerId:e.pointerId,x:e.clientX,y:e.clientY,view:t},e.currentTarget.setPointerCapture(e.pointerId)};this.onPointerMove=e=>{let t=this.panStart;if(t===null||t.pointerId!==e.pointerId)return;let n=e.currentTarget.getBoundingClientRect(),s=Math.min(n.width/t.view.width,n.height/t.view.height)||1;this.viewOverride={...t.view,x:t.view.x-(e.clientX-t.x)/s,y:t.view.y-(e.clientY-t.y)/s}};this.onPointerUp=e=>{this.panStart?.pointerId===e.pointerId&&(this.panStart=null)};this.resetView=()=>{this.viewOverride=null}}areaFloor(e){return this.hass?.areas?.[e]?.floor_id??ie}areaName(e,t){let o=this.hass?.areas?.[e]?.name;return o||(t.type??e)}floorName(e){return e===null||e===ie?a("panel.floor.outdoor"):this.hass?.floors?.[e]?.name??e}flaggedEdges(){return this.focusScope!=="geometry"||this.health===null?new Set:new Set([...this.health.edges_spanning_multiple_floors??[],...this.health.vertical_edges_without_vertical_passage??[]])}flaggedAreas(){if(this.focusScope===null||this.health===null)return new Set;let e=Yt[this.focusScope];if(e===void 0)return new Set;let t=this.health[e];return new Set(Array.isArray(t)?t:[])}visibleAreas(){return this.activeFloor===null?this.areas:this.areas.filter(e=>this.areaFloor(e.area_id)===this.activeFloor)}floorOrder(){return[...this.floors.map(e=>e.floor_id),ie]}render(){let e=this.visibleAreas();if(e.length===0)return c`<div class="empty">${a("map.empty")}</div>`;let t=new Set(e.map(y=>y.area_id)),o=e.map(y=>({areaId:y.area_id,floorId:this.areaFloor(y.area_id)})),n=Re(o,this.floorOrder(),{nodeWidth:J,nodeHeight:Q}),s=this.flaggedAreas(),d=this.flaggedEdges(),p=this.edges.filter(y=>!y.orphaned_at&&t.has(y.area_a)&&t.has(y.area_b)),m=this.offFloorConnectors(t),b=this.viewOverride??n.extent,f=`${b.x} ${b.y} ${b.width} ${b.height}`;return c`
      <div class="wrap">
        <svg
          viewBox=${f}
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
            ${n.bands.length>1?n.bands.map(y=>this.renderBand(y,n.extent)):h}
          </g>
          <g class="edges">
            ${p.map(y=>this.renderEdge(y,n.positions,d.has(y.edge_id)))}
          </g>
          <g class="connectors">
            ${this.renderConnectors(m,n.positions,d)}
          </g>
          <g class="nodes">
            ${e.map(y=>this.renderNode(y,n.positions,s.has(y.area_id)))}
          </g>
        </svg>
        ${this.renderLegend()}
        <div class="overlay">
          ${this.viewOverride!==null?c`<button class="reset" @click=${this.resetView}>${a("map.reset_view")}</button>`:h}
          ${m.length>0?c`<p class="offfloor">${a("map.offfloor",{count:m.length})}</p>`:h}
          <p class="hint">${a("map.hint")}</p>
        </div>
      </div>
    `}renderLegend(){let e=["private","shared","public"],t=["indoor","semi_outdoor","outdoor"];return c`
      <div class="legend">
        <span class="group">
          <span class="caption">${a("map.legend.trust")}</span>
          ${e.map(o=>c`
              <span class="item">
                <span class="swatch trust-${o}"></span>${w("trust",o)}
              </span>
            `)}
        </span>
        <span class="group">
          <span class="caption">${a("map.legend.environment")}</span>
          ${t.map(o=>c`
              <span class="item">
                <span class="swatch env-${o}"></span>${w("environment",o)}
              </span>
            `)}
        </span>
      </div>
    `}renderBand(e,t){return B`
      <g class="band">
        <rect x="0" y=${e.y-12} width=${t.width} height=${e.height+24} rx="12"></rect>
        <text class="band-label" x="12" y=${e.y-18}>${this.floorName(e.floorId)}</text>
      </g>
    `}offFloorConnectors(e){let t=[];for(let o of this.edges){if(o.orphaned_at)continue;let n=e.has(o.area_a);if(n===e.has(o.area_b))continue;let s=n?o.area_a:o.area_b,d=n?o.area_b:o.area_a,p=o.level_delta,m=p===null||p===0?0:Math.sign(n?p:-p);t.push({edge:o,areaId:s,otherId:d,direction:m})}return t}renderConnectors(e,t,o){let n=new Map;for(let s of e){let d=n.get(s.areaId);d===void 0?n.set(s.areaId,[s]):d.push(s)}return[...n.entries()].flatMap(([s,d])=>d.map((p,m)=>this.renderConnector(p,t.get(s),m,d.length,o)))}renderConnector(e,t,o,n,s){if(!t)return h;let d=e.direction>=0,p=J*.6,m=t.x-p/2+(n===1?p/2:p*o/(n-1)),b=t.y+(d?-Q/2:Q/2),f=b+(d?-ht:ht),y=Ne(e.edge),x=e.edge.edge_id===this.selectedEdgeId,P=["connector",`barrier-${y.barrier}`,d?"up":"down",e.direction===0?"unknown":"",s.has(e.edge.edge_id)?"flagged":"",x?"selected":""].join(" "),V=e.direction===0?"map.connector.unknown":d?"map.connector.up":"map.connector.down",ee=a(V,{area:this.areaLabel(e.otherId),floor:this.floorName(this.areaFloor(e.otherId))}),ue=d?f+7:f-7;return B`
      <g
        class=${P}
        tabindex="0"
        @click=${()=>this.emitEdge(e.edge)}
        @keydown=${te=>this.onKey(te,()=>this.emitEdge(e.edge))}
        @dblclick=${te=>this.onConnectorActivate(te,e)}
      >
        <line class="stem" x1=${m} y1=${b} x2=${m} y2=${f}></line>
        <polyline class="head" points=${`${m-6},${ue} ${m},${f} ${m+6},${ue}`}></polyline>
        <text class="connector-label" x=${m} y=${d?f-8:f+18}>${ee}</text>
        <title>${ee} — ${a("map.connector.hint")}</title>
      </g>
    `}onConnectorActivate(e,t){e.stopPropagation(),e.preventDefault();let o=this.areaFloor(t.otherId);this.dispatchEvent(new CustomEvent("floor-requested",{detail:{floorId:o===ie?null:o,areaId:t.otherId},bubbles:!0,composed:!0}))}areaLabel(e){return this.hass?.areas?.[e]?.name??e}renderEdge(e,t,o=!1){let n=t.get(e.area_a),s=t.get(e.area_b);if(!n||!s)return h;let d=Ne(e),p=e.edge_id===this.selectedEdgeId,m=["edge",`barrier-${d.barrier}`,d.perimeter?"perimeter":"",o?"flagged":"",p?"selected":""].join(" ");return B`
      <line
        class=${m}
        x1=${n.x} y1=${n.y} x2=${s.x} y2=${s.y}
        tabindex="0"
        @click=${()=>this.emitEdge(e)}
        @keydown=${b=>this.onKey(b,()=>this.emitEdge(e))}
      ></line>
      ${d.glyph?B`<text class="glyph" x=${(n.x+s.x)/2} y=${(n.y+s.y)/2}>${d.glyph}</text>`:h}
    `}renderNode(e,t,o){let n=t.get(e.area_id);if(!n)return h;let s=e.orphaned_at!==null,d=ut(e),p=["node",`trust-${dt(e.trust)}`,`env-${pt(e.environment)}`,d?"muted":"",o?"flagged":"",s?"orphaned":"",e.area_id===this.selectedAreaId?"selected":""].join(" ");return B`
      <g
        class=${p}
        transform="translate(${n.x-J/2}, ${n.y-Q/2})"
        tabindex="0"
        @click=${()=>this.emitArea(e)}
        @keydown=${m=>this.onKey(m,()=>this.emitArea(e))}
      >
        <rect class="node-body" width=${J} height=${Q} rx="10"></rect>
        <text class="node-label" x=${J/2} y=${Q/2}>
          ${this.areaName(e.area_id,e)}
        </text>
        ${d?B`<title>${a("map.needs_annotation")}</title>`:h}
        ${s?B`<circle class="orphan-badge" cx=${J-8} cy="8" r="7"></circle>
                <title>${a("map.orphaned")}</title>`:h}
      </g>
    `}currentView(){return this.viewOverride??this.contentExtent()}contentExtent(){let e=this.visibleAreas().map(t=>({areaId:t.area_id,floorId:this.areaFloor(t.area_id)}));return Re(e,this.floorOrder(),{nodeWidth:J,nodeHeight:Q}).extent}toSvgPoint(e,t){let n=e.currentTarget.getBoundingClientRect();if(n.width===0||n.height===0)return{x:t.x,y:t.y};let s=Math.min(n.width/t.width,n.height/t.height),d=(n.width-t.width*s)/2,p=(n.height-t.height*s)/2;return{x:t.x+(e.clientX-n.left-d)/s,y:t.y+(e.clientY-n.top-p)/s}}onKey(e,t){(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),t())}emitArea(e){this.dispatchEvent(new CustomEvent("area-selected",{detail:{area:e},bubbles:!0,composed:!0}))}emitEdge(e){this.dispatchEvent(new CustomEvent("edge-selected",{detail:{edge:e},bubbles:!0,composed:!0}))}};O.styles=_`
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
    .connector {
      cursor: pointer;
    }
    .connector .stem,
    .connector .head {
      stroke: var(--primary-text-color, #212121);
      stroke-width: 3;
      fill: none;
      opacity: 0.8;
    }
    .connector.barrier-door .stem {
      stroke-dasharray: 10 6;
    }
    .connector.barrier-solid .stem {
      stroke-dasharray: 2 8;
      opacity: 0.5;
    }
    .connector.unknown .stem,
    .connector.unknown .head {
      opacity: 0.45;
    }
    .connector.flagged .stem,
    .connector.flagged .head {
      stroke: var(--error-color, #f44336);
    }
    .connector:focus,
    .connector.selected {
      outline: none;
    }
    .connector:focus .stem,
    .connector:focus .head,
    .connector.selected .stem,
    .connector.selected .head {
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 5;
    }
    .connector-label {
      text-anchor: middle;
      fill: var(--secondary-text-color, #727272);
      font-size: 12px;
      pointer-events: none;
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
  `,l([u({attribute:!1})],O.prototype,"hass",2),l([u({attribute:!1})],O.prototype,"areas",2),l([u({attribute:!1})],O.prototype,"edges",2),l([u({attribute:!1})],O.prototype,"floors",2),l([u({attribute:!1})],O.prototype,"health",2),l([u({attribute:!1})],O.prototype,"activeFloor",2),l([u({attribute:!1})],O.prototype,"focusScope",2),l([u({attribute:!1})],O.prototype,"selectedAreaId",2),l([u({attribute:!1})],O.prototype,"selectedEdgeId",2),l([v()],O.prototype,"viewOverride",2),O=l([S("topology-floor-map")],O);var Z={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},mt=i=>(...r)=>({_$litDirective$:i,values:r}),Ae=class{constructor(r){}get _$AU(){return this._$AM._$AU}_$AT(r,e,t){this._$Ct=r,this._$AM=e,this._$Ci=t}_$AS(r,e){return this.update(r,e)}update(r,e){return this.render(...e)}};var{I:_o}=it;var ft=i=>i.strings===void 0;var Qt={},gt=(i,r=Qt)=>i._$AH=r;var E=mt(class extends Ae{constructor(i){if(super(i),i.type!==Z.PROPERTY&&i.type!==Z.ATTRIBUTE&&i.type!==Z.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!ft(i))throw Error("`live` bindings can only contain a single expression")}render(i){return i}update(i,[r]){if(r===I||r===h)return r;let e=i.element,t=i.name;if(i.type===Z.PROPERTY){if(r===e[t])return I}else if(i.type===Z.BOOLEAN_ATTRIBUTE){if(!!r===e.hasAttribute(t))return I}else if(i.type===Z.ATTRIBUTE&&e.getAttribute(t)===r+"")return I;return gt(i),r}});function A(i,r){let e=`error.${r.code}`,t=a(e);i.dispatchEvent(new CustomEvent("topology-toast",{detail:{message:t===e?r.message:t},bubbles:!0,composed:!0}))}var Zt=["indoor","outdoor","semi_outdoor"],er=["private","shared","public"],Ue="__custom__",L=class extends ${constructor(){super(...arguments);this.areaTypes={catalog:[],cascade:{}};this.type="";this.environment="";this.trust="";this.custom=!1}willUpdate(e){e.has("area")&&this.area&&(this.type=this.area.type??"",this.environment=this.area.environment??"",this.trust=this.area.trust??"",this.custom=this.type!==""&&!this.areaTypes.catalog.includes(this.type))}get dirty(){return this.type!==(this.area.type??"")||this.environment!==(this.area.environment??"")||this.trust!==(this.area.trust??"")}onTypeSelect(e){let t=e.target.value;if(t===Ue){this.custom=!0,this.type="";return}this.custom=!1,this.applyType(t)}onCustomInput(e){this.type=e.target.value}applyType(e){this.type=e;let t=this.areaTypes.cascade[e];t!==void 0&&(t.environment!==null&&this.environment===""&&(this.environment=t.environment),t.trust!==null&&this.trust===""&&(this.trust=t.trust))}async save(){try{await this.client.updateArea(this.area.area_id,{type:this.type===""?null:this.type,environment:this.environment===""?null:this.environment,trust:this.trust===""?null:this.trust})}catch(e){A(this,e instanceof g?e:new g("store_error",String(e)))}}render(){return c`
      <div class="editor">
        <h3>${a("editor.area.title")}</h3>
        <label>
          ${a("editor.area.type")}
          <select .value=${E(this.custom?Ue:this.type)} @change=${this.onTypeSelect}>
            <option value="" .selected=${!this.custom&&this.type===""}></option>
            ${this.areaTypes.catalog.map(e=>c`
                <option value=${e} .selected=${!this.custom&&this.type===e}>
                  ${w("type",e)}
                </option>
              `)}
            <option value=${Ue} .selected=${this.custom}>
              ${a("editor.area.type.custom")}
            </option>
          </select>
        </label>
        ${this.custom?c`<label>
              ${a("editor.area.type.custom_label")}
              <input .value=${E(this.type)} @input=${this.onCustomInput} />
            </label>`:h}
        <p class="hint">${a("editor.area.type.hint")}</p>
        <label>
          ${a("editor.area.environment")}
          <select
            .value=${E(this.environment)}
            @change=${e=>{this.environment=e.target.value}}
          >
            <option value="" .selected=${this.environment===""}></option>
            ${Zt.map(e=>c`
                <option value=${e} .selected=${this.environment===e}>
                  ${w("environment",e)}
                </option>
              `)}
          </select>
        </label>
        <p class="hint">${a("editor.area.environment.hint")}</p>
        <label>
          ${a("editor.area.trust")}
          <select
            .value=${E(this.trust)}
            @change=${e=>{this.trust=e.target.value}}
          >
            <option value="" .selected=${this.trust===""}></option>
            ${er.map(e=>c`
                <option value=${e} .selected=${this.trust===e}>
                  ${w("trust",e)}
                </option>
              `)}
          </select>
        </label>
        <p class="hint">${a("editor.area.trust.hint")}</p>
        ${this.area.orphaned_at?c`<p class="orphan">${a("map.orphaned")}</p>`:h}
        <div class="actions">
          ${this.dirty?c`<span class="dirty">${a("editor.area.unsaved")}</span>`:h}
          <button class="primary" @click=${this.save}>${a("action.save")}</button>
        </div>
      </div>
    `}};L.styles=_`
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
  `,l([u({attribute:!1})],L.prototype,"client",2),l([u({attribute:!1})],L.prototype,"area",2),l([u({attribute:!1})],L.prototype,"areaTypes",2),l([v()],L.prototype,"type",2),l([v()],L.prototype,"environment",2),l([v()],L.prototype,"trust",2),l([v()],L.prototype,"custom",2),L=l([S("topology-area-editor")],L);function F(i,r){let e=i.find(t=>t.preset_name===r);return e===void 0?null:{passage:e.passage,barrier:e.barrier,glazed:e.glazed_default,preset_name:e.preset_name}}function je(i,r){return i.find(t=>t.preset_name===r)?.sensor_allowed??!1}var tr=["N","E","S","W"],rr=new Set(["door","garage_door","window","opening"]),H=class extends ${constructor(){super(...arguments);this.presets=[];this.scope="interior";this.allowInlineTrust=!1;this.allowOverride=!1}get scopedPresets(){return this.presets.filter(e=>e.scope===this.scope)}get sensorAllowed(){let e=this.connection.preset_name;return e!==void 0&&this.presets.length>0?je(this.presets,e):this.connection.barrier==="door"}sensorCandidates(){let e=this.hass?.states??{},t=Object.values(e).filter(o=>o.entity_id.startsWith("binary_sensor.")).map(o=>({entityId:o.entity_id,label:o.attributes.friendly_name??o.entity_id,preferred:rr.has(o.attributes.device_class??"")}));return t.sort((o,n)=>o.preferred!==n.preferred?o.preferred?-1:1:o.label.localeCompare(n.label)),t.map(({entityId:o,label:n})=>({entityId:o,label:n}))}emit(e,t=[]){let o={...this.connection,...e};for(let n of t)delete o[n];this.dispatchEvent(new CustomEvent("connection-changed",{detail:{connection:o},bubbles:!0,composed:!0}))}onPreset(e){let t=e.target.value,o=F(this.presets,t);if(o===null)return;let n=!je(this.presets,t);this.emit(o,n?["sensor_entity_id"]:[])}onSide(e){let t=e.target.value;if(t===""){this.emit({},["side"]);return}this.emit({side:t})}onSensor(e){let t=e.target.value;if(t===""){this.emit({},["sensor_entity_id"]);return}this.emit({sensor_entity_id:t})}onInlineTrust(e){let t=e.target.value;if(t===""){this.emit({},["inline_trust"]);return}this.emit({inline_trust:t})}render(){let e=this.connection;return c`
      <div class="fields">
        <label>
          ${a("editor.edge.preset")}
          <select .value=${E(e.preset_name??"")} @change=${this.onPreset}>
            <option value="" .selected=${e.preset_name===void 0}></option>
            ${this.scopedPresets.map(t=>c`
                <option
                  value=${t.preset_name}
                  .selected=${e.preset_name===t.preset_name}
                >
                  ${w("preset",t.preset_name)}
                </option>
              `)}
          </select>
        </label>
        <p class="axes">
          ${w("passage",e.passage)} · ${w("barrier",e.barrier)}
        </p>
        <label>
          ${a("editor.connection.side")}
          <select .value=${E(e.side??"")} @change=${this.onSide}>
            <option value="" .selected=${e.side===void 0}>
              ${a("editor.beyond.unset")}
            </option>
            ${tr.map(t=>c`
                <option value=${t} .selected=${e.side===t}>
                  ${w("side",t)}
                </option>
              `)}
          </select>
        </label>
        <label class="check">
          <input
            type="checkbox"
            .checked=${E(e.glazed??!1)}
            @change=${t=>this.emit({glazed:t.target.checked})}
          />
          <span>${a("editor.connection.glazed")}</span>
        </label>
        <label>
          ${a("editor.connection.sensor")}
          ${this.sensorAllowed?c`
                <select .value=${E(e.sensor_entity_id??"")} @change=${this.onSensor}>
                  <option value="" .selected=${e.sensor_entity_id===void 0}>
                    ${a("editor.connection.sensor.none")}
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
              `:c`<span class="disabled">${a("editor.connection.sensor.unavailable")}</span>`}
        </label>
        ${this.sensorAllowed?c`<p class="hint">${a("editor.connection.sensor.hint")}</p>`:h}
        ${this.allowInlineTrust?c`
              <label>
                ${a("editor.exterior.beyond_trust")}
                <select .value=${E(e.inline_trust??"")} @change=${this.onInlineTrust}>
                  <option value="" .selected=${e.inline_trust===void 0}></option>
                  ${["private","shared","public"].map(t=>c`
                      <option value=${t} .selected=${e.inline_trust===t}>
                        ${w("trust",t)}
                      </option>
                    `)}
                </select>
              </label>
              <p class="hint">${a("editor.exterior.beyond_trust.hint")}</p>
            `:h}
        ${this.allowOverride?c`
              <label class="check">
                <input
                  type="checkbox"
                  .checked=${E(e.perimeter_override??!1)}
                  @change=${t=>this.emit({perimeter_override:t.target.checked})}
                />
                <span>${a("editor.connection.override")}</span>
              </label>
              <p class="hint">${a("editor.connection.override.hint")}</p>
            `:h}
      </div>
    `}};H.styles=_`
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
  `,l([u({attribute:!1})],H.prototype,"hass",2),l([u({attribute:!1})],H.prototype,"connection",2),l([u({attribute:!1})],H.prototype,"presets",2),l([u({attribute:!1})],H.prototype,"scope",2),l([u({attribute:!1})],H.prototype,"allowInlineTrust",2),l([u({attribute:!1})],H.prototype,"allowOverride",2),H=l([S("topology-connection-fields")],H);var R=class extends ${constructor(){super(...arguments);this.presets=[];this.connections=[]}willUpdate(e){e.has("edge")&&this.edge&&(this.connections=this.edge.connections.map(t=>({...t})))}replaceConnection(e,t){let o=[...this.connections];o[e]=t,this.connections=o}addConnection(){let t=this.presets.filter(n=>n.scope==="interior")[0],o=t!==void 0?F(this.presets,t.preset_name):{passage:"level",barrier:"open"};this.connections=[...this.connections,o]}removeConnection(e){this.connections=this.connections.filter((t,o)=>o!==e)}async save(){if(this.connections.length===0){await this.deleteEdge();return}try{await this.client.upsertEdge(this.edge.area_a,this.edge.area_b,this.connections)}catch(e){A(this,e instanceof g?e:new g("store_error",String(e)))}}async deleteEdge(){try{await this.client.deleteEdge(this.edge.edge_id),this.dispatchEvent(new CustomEvent("selection-cleared",{bubbles:!0,composed:!0}))}catch(e){A(this,e instanceof g?e:new g("store_error",String(e)))}}areaName(e){return this.hass?.areas?.[e]?.name??e}axisSummary(){let e=this.edge;if(e.axis==="unknown"||e.level_delta===null)return a("editor.edge.axis.unknown");if(e.level_delta===0)return a("editor.edge.axis.horizontal");let t=e.level_delta>0?"editor.edge.axis.vertical_up":"editor.edge.axis.vertical_down";return a(t,{a:this.areaName(e.area_a),b:this.areaName(e.area_b),levels:Math.abs(e.level_delta)})}render(){return c`
      <div class="editor">
        <h3>${a("editor.edge.title")}</h3>
        <p class="axis">${this.axisSummary()}</p>
        <p class="hint">${a("editor.edge.hint")}</p>
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
                ${a("action.remove")}
              </button>
            </div>
          `)}
        ${this.connections.length===0?c`<p class="warn">${a("editor.edge.delete")}</p>`:h}
        <div class="actions">
          <button @click=${this.addConnection}>${a("editor.edge.add")}</button>
          <button class="danger" @click=${this.deleteEdge}>${a("editor.edge.delete")}</button>
          <button class="primary" @click=${this.save}>${a("action.save")}</button>
        </div>
      </div>
    `}};R.styles=_`
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
  `,l([u({attribute:!1})],R.prototype,"client",2),l([u({attribute:!1})],R.prototype,"hass",2),l([u({attribute:!1})],R.prototype,"edge",2),l([u({attribute:!1})],R.prototype,"presets",2),l([v()],R.prototype,"connections",2),R=l([S("topology-edge-editor")],R);var or=["N","E","S","W"],ir=["outdoor","neighbor","earth"],nr={N:"S",S:"N",E:"W",W:"E"},sr={whole_property:"outdoor",unit_within_building:"neighbor"},N=class extends ${constructor(){super(...arguments);this.edges=[];this.occupancyExtent=null}async setSide(e,t){try{await this.client.setBeyond(this.area.area_id,e,t===""?null:t)}catch(o){A(this,o instanceof g?o:new g("store_error",String(o)))}}interiorSides(){let e=new Map,t=this.area.area_id;for(let o of this.edges){if(o.orphaned_at!==null)continue;let n=o.area_a===t,s=o.area_b===t;if(!n&&!s)continue;let d=n?o.area_b:o.area_a,p=this.hass?.areas?.[d]?.name??d;for(let m of o.connections){if(m.side===void 0)continue;let b=n?m.side:nr[m.side],f=e.get(b)??[];f.includes(p)||f.push(p),e.set(b,f)}}return e}render(){let e=this.interiorSides();return c`
      <div class="editor">
        <h3>${a("editor.beyond.title")}</h3>
        <p class="hint">${a("editor.beyond.hint")}</p>
        ${or.map(t=>{let o=e.get(t),n=this.area.beyond[t],s=n===void 0&&o===void 0&&this.occupancyExtent!==null?sr[this.occupancyExtent]:null;return c`
            <div class="side">
              <label>
                <span class="side-name">${w("side",t)}</span>
                <select
                  .value=${E(n??"")}
                  @change=${d=>this.setSide(t,d.target.value)}
                >
                  <option value="" .selected=${n===void 0}>
                    ${a("editor.beyond.unset")}
                  </option>
                  ${ir.map(d=>c`
                      <option value=${d} .selected=${n===d}>
                        ${w("beyond",d)}
                      </option>
                    `)}
                </select>
              </label>
              ${o!==void 0?c`<p class="interior">
                    ${a("editor.beyond.interior",{areas:o.join(", ")})}
                  </p>`:h}
              ${s!==null?c`<p class="suggestion">
                    <button class="link" @click=${()=>this.setSide(t,s)}>
                      ${a("editor.beyond.suggest",{value:w("beyond",s)})}
                    </button>
                  </p>`:h}
            </div>
          `})}
      </div>
    `}};N.styles=_`
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
  `,l([u({attribute:!1})],N.prototype,"client",2),l([u({attribute:!1})],N.prototype,"hass",2),l([u({attribute:!1})],N.prototype,"area",2),l([u({attribute:!1})],N.prototype,"edges",2),l([u({attribute:!1})],N.prototype,"occupancyExtent",2),N=l([S("topology-beyond-editor")],N);var M=class extends ${constructor(){super(...arguments);this.presets=[];this.flagged=!1;this.connections=[]}willUpdate(e){e.has("area")&&this.area&&(this.connections=this.area.exterior_connections.map(t=>({...t})))}get exteriorPresets(){return this.presets.filter(e=>e.scope==="exterior")}addConnection(){let e=this.exteriorPresets,t=e.find(n=>n.preset_name==="window")??e[0],o=t!==void 0?F(this.presets,t.preset_name):{passage:"none",barrier:"door"};this.connections=[...this.connections,o]}replaceConnection(e,t){let o=[...this.connections];o[e]=t,this.connections=o}removeConnection(e){this.connections=this.connections.filter((t,o)=>o!==e)}async save(){try{await this.client.setExteriorConnections(this.area.area_id,this.connections)}catch(e){A(this,e instanceof g?e:new g("store_error",String(e)))}}declaredSides(){return Object.keys(this.area.beyond)}render(){let e=this.connections.filter(t=>t.side===void 0).length;return c`
      <div class="editor ${this.flagged?"flagged":""}">
        <h3>${a("editor.exterior.title")}</h3>
        <p class="hint">${a("editor.exterior.hint")}</p>
        ${this.connections.length===0?c`<p class="empty">${a("editor.exterior.none")}</p>`:h}
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
                ${a("action.remove")}
              </button>
            </div>
          `)}
        ${e>0?c`<p class="warn">${a("editor.exterior.sideless")}</p>`:h}
        ${this.declaredSides().length>0?c`<p class="hint">
              ${a("editor.exterior.outer_sides",{sides:this.declaredSides().map(t=>w("side",t)).join(", ")})}
            </p>`:h}
        <div class="actions">
          <button @click=${this.addConnection}>${a("editor.edge.add")}</button>
          <button class="primary" @click=${this.save}>${a("action.save")}</button>
        </div>
      </div>
    `}};M.styles=_`
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
  `,l([u({attribute:!1})],M.prototype,"client",2),l([u({attribute:!1})],M.prototype,"hass",2),l([u({attribute:!1})],M.prototype,"area",2),l([u({attribute:!1})],M.prototype,"presets",2),l([u({attribute:!1})],M.prototype,"flagged",2),l([v()],M.prototype,"connections",2),M=l([S("topology-exterior-editor")],M);var ar=new Set(["stairs","ramp","elevator","ladder","hatch"]);function vt(i,r){if(i===null||r===null)return"unknown";let e=r-i;return e===0?"same":e===1?"above":e===-1?"below":"distant"}function bt(i,r){let e=i.filter(o=>o.scope==="interior");if(r==="unknown")return e;let t=r!=="same";return e.filter(o=>o.passage==="none"||ar.has(o.passage)===t)}function yt(i,r){return i.level_delta===null?null:i.area_a===r?i.level_delta:-i.level_delta}var lr=["same","above","below","distant","unknown"],cr={same:"editor.neighbors.group.same",above:"editor.neighbors.group.above",below:"editor.neighbors.group.below",distant:"editor.neighbors.group.distant",unknown:"editor.neighbors.group.unknown"},C=class extends ${constructor(){super(...arguments);this.areas=[];this.edges=[];this.floors=[];this.presets=[];this.pickedArea="";this.pickedPreset="";this.busy=!1}willUpdate(e){e.has("area")&&(this.pickedArea="",this.pickedPreset="")}areaName(e){return this.hass?.areas?.[e]?.name??e}levelOf(e){let t=this.hass?.areas?.[e]?.floor_id??null;return t===null?null:this.floors.find(n=>n.floor_id===t)?.effective_level??null}relationTo(e){return vt(this.levelOf(this.area.area_id),this.levelOf(e))}currentNeighbors(){return this.edges.filter(e=>!e.orphaned_at&&(e.area_a===this.area.area_id||e.area_b===this.area.area_id)).map(e=>({edge:e,otherId:e.area_a===this.area.area_id?e.area_b:e.area_a}))}candidates(){let e=new Set(this.currentNeighbors().map(t=>t.otherId));return this.areas.filter(t=>t.area_id!==this.area.area_id&&t.orphaned_at===null&&!e.has(t.area_id)&&this.hass?.areas?.[t.area_id]!==void 0).map(t=>({areaId:t.area_id,name:this.areaName(t.area_id),relation:this.relationTo(t.area_id)})).sort((t,o)=>t.name.localeCompare(o.name))}offeredPresets(){let e=this.pickedArea===""?"unknown":this.relationTo(this.pickedArea);return bt(this.presets,e)}async addNeighbor(){if(this.pickedArea===""||this.pickedPreset==="")return;let e=F(this.presets,this.pickedPreset);if(e!==null){this.busy=!0;try{await this.client.upsertEdge(this.area.area_id,this.pickedArea,[e]),this.pickedArea="",this.pickedPreset=""}catch(t){A(this,t instanceof g?t:new g("store_error",String(t)))}finally{this.busy=!1}}}select(e){this.dispatchEvent(new CustomEvent("edge-selected",{detail:{edge:e},bubbles:!0,composed:!0}))}relationSummary(e,t){if(e.axis==="unknown"||e.level_delta===null)return a("editor.edge.axis.unknown");if(e.level_delta===0)return a("editor.edge.axis.horizontal");let o=yt(e,this.area.area_id)??0,n=o>0?"editor.edge.axis.vertical_up":"editor.edge.axis.vertical_down";return a(n,{a:this.areaName(this.area.area_id),b:this.areaName(t),levels:Math.abs(o)})}render(){let e=this.currentNeighbors(),t=this.candidates(),o=this.offeredPresets(),n=this.pickedArea!==""&&this.relationTo(this.pickedArea)==="distant";return c`
      <div class="editor">
        <h3>${a("editor.neighbors.title")}</h3>
        <p class="hint">${a("editor.neighbors.hint")}</p>
        ${e.length===0?c`<p class="empty">${a("editor.neighbors.none")}</p>`:c`<ul>
              ${e.map(({edge:s,otherId:d})=>c`
                  <li>
                    <div class="row">
                      <button class="link" @click=${()=>this.select(s)}>
                        ${this.areaName(d)}
                      </button>
                      <span class="kinds">
                        ${s.connections.map(p=>p.preset_name!==void 0?w("preset",p.preset_name):w("passage",p.passage)).join(", ")}
                      </span>
                    </div>
                    <p class="relation">${this.relationSummary(s,d)}</p>
                  </li>
                `)}
            </ul>`}
        ${t.length===0?h:c`
              <div class="add">
                <label>
                  ${a("editor.neighbors.area")}
                  <select
                    .value=${E(this.pickedArea)}
                    @change=${s=>{this.pickedArea=s.target.value,this.pickedPreset=""}}
                  >
                    <option value="" .selected=${this.pickedArea===""}>
                      ${a("editor.neighbors.pick")}
                    </option>
                    ${lr.map(s=>{let d=t.filter(p=>p.relation===s);return d.length===0?h:c`
                        <optgroup label=${a(cr[s])}>
                          ${d.map(p=>c`
                              <option value=${p.areaId} .selected=${this.pickedArea===p.areaId}>
                                ${p.name}
                              </option>
                            `)}
                        </optgroup>
                      `})}
                  </select>
                </label>
                ${n?c`<p class="warn">${a("editor.neighbors.distant_warning")}</p>`:h}
                <label>
                  ${a("editor.edge.preset")}
                  <select
                    .value=${E(this.pickedPreset)}
                    @change=${s=>{this.pickedPreset=s.target.value}}
                  >
                    <option value="" .selected=${this.pickedPreset===""}></option>
                    ${o.map(s=>c`
                        <option
                          value=${s.preset_name}
                          .selected=${this.pickedPreset===s.preset_name}
                        >
                          ${w("preset",s.preset_name)}
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
                    ${a("editor.neighbors.add")}
                  </button>
                </div>
              </div>
            `}
      </div>
    `}};C.styles=_`
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
  `,l([u({attribute:!1})],C.prototype,"client",2),l([u({attribute:!1})],C.prototype,"hass",2),l([u({attribute:!1})],C.prototype,"area",2),l([u({attribute:!1})],C.prototype,"areas",2),l([u({attribute:!1})],C.prototype,"edges",2),l([u({attribute:!1})],C.prototype,"floors",2),l([u({attribute:!1})],C.prototype,"presets",2),l([v()],C.prototype,"pickedArea",2),l([v()],C.prototype,"pickedPreset",2),l([v()],C.prototype,"busy",2),C=l([S("topology-neighbors-editor")],C);var z=class extends ${constructor(){super(...arguments);this.floors=[];this.flagged=new Set}floorName(e){return this.hass?.floors?.[e]?.name??e}async setLevel(e,t){let o=t.trim()===""?null:Number.parseInt(t,10);if(!(o!==null&&Number.isNaN(o)))try{await this.client.setFloorLevel(e.floor_id,o)}catch(n){A(this,n instanceof g?n:new g("store_error",String(n)))}}render(){return c`
      <div class="editor">
        <h3>${a("editor.floor.title")}</h3>
        <p class="hint">${a("editor.floor.hint")}</p>
        ${this.floors.length===0?c`<p class="hint">${a("editor.floor.unset")}</p>`:h}
        ${this.floors.map(e=>c`
            <div class="row ${this.flagged.has(e.floor_id)?"flagged":""}">
              <span class="name">${this.floorName(e.floor_id)}</span>
              ${e.registry_level===null?c`
                    <label>
                      ${a("editor.floor.override")}
                      <input
                        type="number"
                        .value=${E(e.level_override===null?"":String(e.level_override))}
                        @change=${t=>this.setLevel(e,t.target.value)}
                      />
                    </label>
                  `:c`<span class="registry">
                    ${a("editor.floor.from_registry")}: ${e.registry_level}
                  </span>`}
              <span class="effective">
                ${a("editor.floor.effective")}:
                ${e.effective_level===null?"\u2014":e.effective_level}
              </span>
            </div>
          `)}
      </div>
    `}};z.styles=_`
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
  `,l([u({attribute:!1})],z.prototype,"client",2),l([u({attribute:!1})],z.prototype,"hass",2),l([u({attribute:!1})],z.prototype,"floors",2),l([u({attribute:!1})],z.prototype,"flagged",2),z=l([S("topology-floor-editor")],z);var $t=["aliases","labels"],dr="topology",pr="import_from_core",xt="topology.first-run.dismissed";function ze(i){let r=new Set;if(!i)return r;let e=null;try{e=i.getItem(xt)}catch{return r}if(e===null)return r;let t;try{t=JSON.parse(e)}catch{return r}if(!Array.isArray(t))return r;for(let o of t)$t.includes(o)&&r.add(o);return r}function _t(i,r){let e=ze(i);if(e.add(r),i)try{i.setItem(xt,JSON.stringify([...e]))}catch{}return e}function wt(i,r=new Set){return i?$t.filter(e=>i.imports_done_at[e]===null&&!r.has(e)):[]}async function Et(i,r){if(typeof i.callService!="function")throw new Error("hass.callService is unavailable");await i.callService(dr,pr,{source:r})}var W=class extends ${constructor(){super(...arguments);this.dismissed=new Set;this.running=null}connectedCallback(){super.connectedCallback(),this.dismissed=ze(this.storage)}get storage(){try{return window.localStorage??null}catch{return null}}async runSource(e){this.running=e;try{await Et(this.hass,e)}catch(t){A(this,t instanceof g?t:new g("store_error",String(t)))}finally{this.running=null}}dismissSource(e){this.dismissed=_t(this.storage,e)}render(){let e=wt(this.homeConfig,this.dismissed);return e.length===0?h:c`
      <div class="card">
        <h3>${a("first_run.title")}</h3>
        <p class="hint">${a("first_run.hint")}</p>
        ${e.map(t=>c`
            <div class="row">
              <span class="label">${a(`first_run.source.${t}`)}</span>
              <div class="actions">
                <button
                  class="primary"
                  ?disabled=${this.running!==null}
                  @click=${()=>this.runSource(t)}
                >
                  ${this.running===t?a("first_run.running"):a("first_run.import")}
                </button>
                <button
                  class="link"
                  ?disabled=${this.running!==null}
                  @click=${()=>this.dismissSource(t)}
                >
                  ${a("first_run.dismiss")}
                </button>
              </div>
            </div>
          `)}
      </div>
    `}};W.styles=_`
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
  `,l([u({attribute:!1})],W.prototype,"hass",2),l([u({attribute:!1})],W.prototype,"homeConfig",2),l([v()],W.prototype,"dismissed",2),l([v()],W.prototype,"running",2),W=l([S("topology-first-run-card")],W);var ur=["whole_property","unit_within_building"],T=class extends ${constructor(){super(...arguments);this.occupancy="whole_property";this.threshold=3;this.projectEnvironment=!1;this.projectType=!1;this.projectTrust=!1}willUpdate(e){e.has("homeConfig")&&this.homeConfig&&(this.occupancy=this.homeConfig.occupancy_extent,this.threshold=this.homeConfig.unannotated_repair_threshold,this.projectEnvironment=this.homeConfig.projection_toggles.environment,this.projectType=this.homeConfig.projection_toggles.type,this.projectTrust=this.homeConfig.projection_toggles.trust)}async save(){try{await this.client.updateHomeConfig({occupancy_extent:this.occupancy,unannotated_repair_threshold:this.threshold,projection_toggles:{environment:this.projectEnvironment,type:this.projectType,trust:this.projectTrust}})}catch(e){A(this,e instanceof g?e:new g("store_error",String(e)))}}render(){return c`
      <div class="editor">
        <h3>${a("editor.home.title")}</h3>
        <label>
          ${a("editor.home.occupancy")}
          <select
            .value=${E(this.occupancy)}
            @change=${e=>{this.occupancy=e.target.value}}
          >
            ${ur.map(e=>c`
                <option value=${e} .selected=${this.occupancy===e}>
                  ${w("occupancy",e)}
                </option>
              `)}
          </select>
        </label>
        <p class="hint">${a("editor.home.occupancy.hint")}</p>
        <label>
          ${a("editor.home.threshold")}
          <input
            type="number"
            min="1"
            max="100"
            .value=${E(String(this.threshold))}
            @change=${e=>{this.threshold=Number.parseInt(e.target.value,10)||1}}
          />
        </label>
        <p class="hint">${a("editor.home.threshold.hint")}</p>
        <h4>${a("editor.home.projection")}</h4>
        <p class="hint">${a("editor.home.projection.hint")}</p>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${E(this.projectEnvironment)}
            @change=${e=>{this.projectEnvironment=e.target.checked}}
          />
          ${a("editor.home.project_environment")}
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${E(this.projectType)}
            @change=${e=>{this.projectType=e.target.checked}}
          />
          ${a("editor.home.project_type")}
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${E(this.projectTrust)}
            @change=${e=>{this.projectTrust=e.target.checked}}
          />
          ${a("editor.home.project_trust")}
        </label>
        <div class="actions">
          <button class="primary" @click=${this.save}>${a("action.save")}</button>
        </div>
      </div>
    `}};T.styles=_`
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
  `,l([u({attribute:!1})],T.prototype,"client",2),l([u({attribute:!1})],T.prototype,"homeConfig",2),l([v()],T.prototype,"occupancy",2),l([v()],T.prototype,"threshold",2),l([v()],T.prototype,"projectEnvironment",2),l([v()],T.prototype,"projectType",2),l([v()],T.prototype,"projectTrust",2),T=l([S("topology-home-config-editor")],T);var D=class extends ${constructor(){super(...arguments);this.areas=[];this.edges=[]}get orphanedAreas(){return this.areas.filter(e=>e.orphaned_at!==null)}get orphanedEdges(){return this.edges.filter(e=>e.orphaned_at!==null)}areaLabel(e){return this.hass?.areas?.[e]?.name??e}restorable(e){return!!this.hass?.areas?.[e.area_a]&&!!this.hass?.areas?.[e.area_b]}async restore(e){try{await this.client.restoreEdge(e.edge_id)}catch(t){A(this,t instanceof g?t:new g("store_error",String(t)))}}render(){let e=this.orphanedAreas,t=this.orphanedEdges;return e.length===0&&t.length===0?c`<div class="editor"><p>${a("editor.orphans.empty")}</p></div>`:c`
      <div class="editor">
        <h3>${a("editor.orphans.title")}</h3>
        ${e.map(o=>c`<div class="row"><span>${this.areaLabel(o.area_id)}</span></div>`)}
        ${t.map(o=>c`
            <div class="row">
              <span>${this.areaLabel(o.area_a)} ↔ ${this.areaLabel(o.area_b)}</span>
              <button
                ?disabled=${!this.restorable(o)}
                @click=${()=>this.restore(o)}
              >
                ${a("editor.orphans.restore")}
              </button>
            </div>
          `)}
      </div>
    `}};D.styles=_`
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
  `,l([u({attribute:!1})],D.prototype,"client",2),l([u({attribute:!1})],D.prototype,"hass",2),l([u({attribute:!1})],D.prototype,"areas",2),l([u({attribute:!1})],D.prototype,"edges",2),D=l([S("topology-orphans-view")],D);var We="__all__",k=class extends ${constructor(){super(...arguments);this.narrow=!1;this.store=null;this.view="map";this.focusScope=null;this.activeFloor=null;this.selectedAreaId=null;this.selectedEdgeId=null;this.toastMessage=null;this.client=null;this.removeListener=null;this.onToast=e=>{this.toastMessage=e.detail.message,window.setTimeout(()=>{this.toastMessage=null},4e3)};this.onAreaSelected=e=>{this.selectedAreaId=e.detail.area.area_id,this.selectedEdgeId=null};this.onEdgeSelected=e=>{this.selectedEdgeId=e.detail.edge.edge_id,this.selectedAreaId=null};this.onFloorRequested=e=>{this.activeFloor=e.detail.floorId,this.selectedAreaId=e.detail.areaId,this.selectedEdgeId=null};this.clearSelection=()=>{this.selectedAreaId=null,this.selectedEdgeId=null};this.onKeyDown=e=>{e.key==="Escape"&&(this.selectedAreaId!==null||this.selectedEdgeId!==null)&&this.clearSelection()};this.goHome=()=>{this.view="map",this.focusScope=null,this.clearSelection(),this.syncUrl()}}connectedCallback(){super.connectedCallback(),this.client=new Ee(this.hass.connection);let e=new Se(this.client);this.store=e,this.removeListener=e.addListener(()=>this.requestUpdate());let t=at(window.location.search);this.view=t.view,this.focusScope=t.focus,e.connect(),this.addEventListener("topology-toast",this.onToast),this.addEventListener("area-selected",this.onAreaSelected),this.addEventListener("edge-selected",this.onEdgeSelected),this.addEventListener("floor-requested",this.onFloorRequested),this.addEventListener("selection-cleared",this.clearSelection),this.addEventListener("keydown",this.onKeyDown)}disconnectedCallback(){super.disconnectedCallback(),this.removeListener?.(),this.store?.dispose(),this.removeEventListener("topology-toast",this.onToast),this.removeEventListener("area-selected",this.onAreaSelected),this.removeEventListener("edge-selected",this.onEdgeSelected),this.removeEventListener("floor-requested",this.onFloorRequested),this.removeEventListener("selection-cleared",this.clearSelection),this.removeEventListener("keydown",this.onKeyDown)}willUpdate(e){e.has("hass")&&this.store&&this.hass&&this.store.handleConnectionState(this.hass.connection.connected??!0)}syncUrl(){let e=st(this.focusScope),t=`${window.location.pathname}${e}`;t!==`${window.location.pathname}${window.location.search}`&&window.history.replaceState(window.history.state,"",t)}get snapshot(){return this.store?.state.snapshot??null}get health(){return this.store?.state.health??null}get selectedArea(){return this.selectedAreaId===null?null:this.snapshot?.areas.find(e=>e.area_id===this.selectedAreaId)??null}get selectedEdge(){return this.selectedEdgeId===null?null:this.snapshot?.edges.find(e=>e.edge_id===this.selectedEdgeId)??null}floorButtons(){let e=this.snapshot,t=[{id:We,label:a("panel.floor.all")}];for(let o of e?.floors??[])t.push({id:o.floor_id,label:this.hass.floors?.[o.floor_id]?.name??o.floor_id});return t.push({id:ie,label:a("panel.floor.outdoor")}),t}render(){let e=this.store?.state;return c`
      <div class="root">
        ${e&&!e.connected?c`<div class="banner reconnecting">${a("banner.reconnecting")}</div>`:h}
        ${e?.error?c`<div class="banner error">${a("banner.error")}</div>`:h}
        <header>
          <h1>${a("panel.title")}</h1>
          <nav class="views">
            <button
              class=${this.isHome()?"active":""}
              @click=${this.goHome}
              title=${a("panel.nav.back")}
            >
              ${a("panel.nav.home")}
            </button>
            <button
              class=${this.view==="floors"?"active":""}
              @click=${()=>this.openView("floors")}
            >
              ${a("panel.nav.floors")}
            </button>
            <button
              class=${this.view==="orphans"?"active":""}
              @click=${()=>this.openView("orphans")}
            >
              ${a("panel.nav.orphans")}
            </button>
          </nav>
        </header>
        <nav class="floors">
          ${this.floorButtons().map(t=>c`
              <button
                class=${(this.activeFloor??We)===t.id?"active":""}
                @click=${()=>{this.activeFloor=t.id===We?null:t.id}}
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
        ${this.renderCloseBar(a("panel.nav.floors"))}
        <topology-floor-editor
          .client=${this.client}
          .hass=${this.hass}
          .floors=${e.floors}
          .flagged=${new Set(this.health?.indoor_areas_without_floor??[])}
        ></topology-floor-editor>
      `:this.view==="orphans"?c`
        ${this.renderCloseBar(a("panel.nav.orphans"))}
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
        <button @click=${this.goHome} title=${a("panel.nav.back")}>
          ${a("action.close")}
        </button>
      </div>
    `}edgeTitle(e){let t=o=>this.hass.areas?.[o]?.name??o;return a("editor.edge.between",{a:t(e.area_a),b:t(e.area_b)})}renderFlagged(){if(this.focusScope===null||this.health===null)return h;if(this.focusScope==="geometry")return this.renderFlaggedEdges();let e=this.focusScope==="unannotated"?"unannotated_areas":this.focusScope==="isolated"?"isolated_areas":this.focusScope==="bearings"?"contradictory_bearings":this.focusScope==="exterior"?"exterior_on_non_outdoor_side":null;if(e===null)return h;let t=this.health[e],o=this.focusScope==="unannotated"?a("sidebar.unannotated"):this.focusScope==="isolated"?a("sidebar.isolated"):this.focusScope==="bearings"?a("sidebar.bearings"):a("editor.exterior.title");return c`
      <div class="flagged-list">
        <h3>${o}</h3>
        ${t.length===0?c`<p>${a("sidebar.none")}</p>`:c`<ul>
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
    `}renderFlaggedEdges(){let e=this.health,t=this.snapshot;if(e===null||t===null)return h;let o=[{title:a("sidebar.spanning"),ids:e.edges_spanning_multiple_floors??[]},{title:a("sidebar.no_climb"),ids:e.vertical_edges_without_vertical_passage??[]}];return c`
      <div class="flagged-list">
        ${o.map(n=>c`
            <h3>${n.title}</h3>
            ${n.ids.length===0?c`<p>${a("sidebar.none")}</p>`:c`<ul>
                  ${n.ids.map(s=>{let d=t.edges.find(p=>p.edge_id===s);return c`<li>
                      <button
                        class="link"
                        @click=${()=>{this.selectedEdgeId=s,this.selectedAreaId=null}}
                      >
                        ${d!==void 0?this.edgeTitle(d):s}
                      </button>
                    </li>`})}
                </ul>`}
          `)}
      </div>
    `}};k.styles=_`
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
  `,l([u({attribute:!1})],k.prototype,"hass",2),l([u({attribute:!1})],k.prototype,"narrow",2),l([u({attribute:!1})],k.prototype,"route",2),l([u({attribute:!1})],k.prototype,"panel",2),l([v()],k.prototype,"store",2),l([v()],k.prototype,"view",2),l([v()],k.prototype,"focusScope",2),l([v()],k.prototype,"activeFloor",2),l([v()],k.prototype,"selectedAreaId",2),l([v()],k.prototype,"selectedEdgeId",2),l([v()],k.prototype,"toastMessage",2),k=l([S("topology-panel")],k);export{k as TopologyPanel};
//# sourceMappingURL=topology-panel.js.map
