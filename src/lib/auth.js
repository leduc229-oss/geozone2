window.GZA=(function(){
  var UK='gz:users',SK='gz:session',ITER=120000,DAY=864e5,mem={},lock={},next=null,nagged=0,tt;
  var EM=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function st(s){try{return s?sessionStorage:localStorage;}catch(e){return null;}}
  function get(k,s){try{return st(s).getItem(k);}catch(e){return mem[(s?'s:':'l:')+k]||null;}}
  function set(k,v,s){try{st(s).setItem(k,v);}catch(e){mem[(s?'s:':'l:')+k]=v;}}
  function del(k,s){try{st(s).removeItem(k);}catch(e){delete mem[(s?'s:':'l:')+k];}}
  function json(s,d){try{var v=JSON.parse(s);return v==null?d:v;}catch(e){return d;}}
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function b64e(u){var s='';for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s);}
  function b64d(s){return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0);});}
  function rnd(n){var u=new Uint8Array(n);crypto.getRandomValues(u);return u;}
  function uid(){return Date.now().toString(36)+b64e(rnd(6)).replace(/[^a-z0-9]/gi,'');}
  async function hash(pw,salt){
    if(window.crypto&&crypto.subtle){
      var k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);
      return b64e(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:b64d(salt),iterations:ITER,hash:'SHA-256'},k,256)));
    }
    var h=5381,s=salt+pw;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return 'x'+h;
  }
  function users(){return json(get(UK),[]);}
  function saveUsers(a){set(UK,JSON.stringify(a));}
  function session(){var s=json(get(SK),null)||json(get(SK,1),null);return s&&s.exp>Date.now()?s:null;}
  function user(){var s=session();return s?(users().filter(function(u){return u.id===s.uid;})[0]||null):null;}
  function begin(u,rem){del(SK);del(SK,1);set(SK,JSON.stringify({uid:u.id,exp:Date.now()+(rem?30*DAY:DAY)}),!rem);}
  function tripKey(){var u=user();return u?'gz:trips:'+u.id:'gz:trips';}
  function mergeFav(u){
    var g=json(get('gz:favs'),[]);if(!g.length)return;
    var k='gz:favs:'+u.id,a=json(get(k),[]),ids={};
    a.forEach(function(f){ids[f.k]=1;});
    g.forEach(function(f){if(!ids[f.k])a.push(f);});
    a.sort(function(x,y){return y.t-x.t;});
    set(k,JSON.stringify(a));del('gz:favs');
  }
  function merge(u){
    mergeFav(u);
    var g=json(get('gz:trips'),[]);if(!g.length)return 0;
    var k='gz:trips:'+u.id,a=json(get(k),[]),ids={},n=0;
    a.forEach(function(t){ids[t.id]=1;});
    g.forEach(function(t){if(!ids[t.id]){a.push(t);n++;}});
    a.sort(function(x,y){return y.createdAt-x.createdAt;});
    set(k,JSON.stringify(a));del('gz:trips');return n;
  }
  function ini(n){var w=n.trim().split(/\s+/);return ((w[0][0]||'')+(w.length>1?w[w.length-1][0]:(w[0][1]||''))).toLocaleUpperCase('vi');}
  function pwBad(p){return p.length<8?'Mật khẩu cần ít nhất 8 ký tự.':(!/[A-Za-zÀ-ỹ]/.test(p)||!/\d/.test(p))?'Mật khẩu cần có cả chữ và số.':'';}
  function nameBad(n){return n.length<2||n.length>40?'Tên cần từ 2 đến 40 ký tự.':'';}
  function mailBad(e){return EM.test(e)?'':'Email không hợp lệ.';}
  var ADMIN={email:'admin@geozone.vn',name:'Admin Demo',pw:'admin123'};
  function isAdmin(){var u=user();return !!u&&u.role==='admin';}
  var seedP=(async function(){
    try{
      var a=users(),x=a.filter(function(u){return u.email===ADMIN.email;})[0];
      if(x){if(x.role!=='admin'){x.role='admin';saveUsers(a);}return;}
      var salt=b64e(rnd(16)),h=await hash(ADMIN.pw,salt);
      a=users();if(a.some(function(u){return u.email===ADMIN.email;}))return;
      a.push({id:uid(),name:ADMIN.name,email:ADMIN.email,salt:salt,hash:h,role:'admin',created:Date.now()});saveUsers(a);
    }catch(e){}
  })();
return {users:users,saveUsers:saveUsers,user:user,begin:begin,merge:merge,hash:hash,b64e:b64e,rnd:rnd,uid:uid,ini:ini,pwBad:pwBad,nameBad:nameBad,mailBad:mailBad,json:json,get:get,set:set,del:del,SK:SK,ADMIN:ADMIN,seedP:seedP};
})();

export const GZA = window.GZA;
export default GZA;
