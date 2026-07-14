let csrf='';
async function request(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{Accept:'application/json','Content-Type':'application/json',...(csrf?{'X-CSRF-TOKEN':csrf}:{}),...(options.headers||{})}});
  const json=await response.json().catch(()=>null);
  if(!response.ok||!json?.success)throw new Error(json?.error?.message||`HTTP ${response.status}`);
  return json.data;
}
export const api={
  async me(){const data=await request('/api/auth/me');csrf=data.csrf;return data.user},
  async login(login,password){const data=await request('/api/auth/login',{method:'POST',body:JSON.stringify({login,password})});csrf=data.csrf;return data.user},
  logout:()=>request('/api/auth/logout',{method:'POST',body:'{}'}),
  get:request,
  patch:(path,data)=>request(path,{method:'PATCH',body:JSON.stringify(data)}),
};
