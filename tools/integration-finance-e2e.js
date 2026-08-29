import assert from 'node:assert/strict';

const baseUrl=process.env.INTEGRATION_API_URL||'http://127.0.0.1:3000/api';
async function request(path,{method='GET',token='',body}={}){const response=await fetch(`${baseUrl}${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`${method} ${path} -> ${response.status}: ${payload.error||JSON.stringify(payload)}`);return payload}
function firstMondayThisMonth(){const now=new Date();const first=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));const offset=(8-first.getUTCDay())%7;return new Date(first.getTime()+offset*86400000)}

async function main(){
  const suffix=Date.now();const managerEmail=`finance-manager-${suffix}@example.test`;const employeeEmail=`finance-employee-${suffix}@example.test`;const managerPassword='ManagerPass123!';const employeePassword='EmployeePass123!';
  const registered=await request('/auth/register-company',{method:'POST',body:{firstName:'Finance',lastName:'Manager',email:managerEmail,password:managerPassword,companyName:`Finance QA ${suffix}`}});const managerToken=registered.token;assert.ok(managerToken);
  const projectA=await request('/projects',{method:'POST',token:managerToken,body:{name:'Finance Project A',address:'Praha'}});const projectB=await request('/projects',{method:'POST',token:managerToken,body:{name:'Finance Project B',address:'Praha'}});assert.ok(projectA.project?.id);assert.ok(projectB.project?.id);
  const employeeCreated=await request('/manager/employees',{method:'POST',token:managerToken,body:{firstName:'Finance',lastName:'Employee',email:employeeEmail,temporaryPassword:employeePassword,hourlyRateCzk:'250.00'}});const employeeId=employeeCreated.employee?.id;assert.ok(employeeId);
  const login=await request('/auth/login',{method:'POST',body:{email:employeeEmail,password:employeePassword}});const employeeToken=login.token;assert.ok(employeeToken);
  await request('/work-rules',{method:'PATCH',token:managerToken,body:{breakMinutes:60,standardDailyHours:8}});
  const monday=firstMondayThisMonth();const tuesday=new Date(monday.getTime()+86400000);const weekStart=monday.toISOString().slice(0,10);const secondDay=tuesday.toISOString().slice(0,10);const invoiceMonth=weekStart.slice(0,7);
  await request('/work-entries',{method:'POST',token:employeeToken,body:{projectId:projectA.project.id,workDate:weekStart,hours:'4'}});
  await request('/work-entries',{method:'POST',token:employeeToken,body:{projectId:projectB.project.id,workDate:weekStart,hours:'5'}});
  await request(`/manager/employees/${employeeId}`,{method:'PATCH',token:managerToken,body:{hourlyRateCzk:'300.00'}});
  await request('/work-entries',{method:'POST',token:employeeToken,body:{projectId:projectA.project.id,workDate:secondDay,hours:'8'}});
  const submitted=await request('/weekly-submissions',{method:'POST',token:employeeToken,body:{weekStart}});assert.equal(submitted.submission?.status,'SUBMITTED');
  await request(`/manager/submissions/${submitted.submission.id}/approve`,{method:'POST',token:managerToken});
  const week=await request(`/work-entries?weekStart=${weekStart}`,{token:employeeToken});assert.equal(week.summary?.approvedHours,'15.00');assert.equal(week.summary?.confirmedSalaryCzk,'4100.00');
  const payroll=await request(`/manager/payroll?period=week&anchor=${weekStart}`,{token:managerToken});assert.equal(payroll.summary?.approvedHours,'15.00');assert.equal(payroll.summary?.confirmedSalaryCzk,'4100.00');const payrollEmployee=payroll.employees?.find(item=>item.id===employeeId);assert.equal(payrollEmployee?.mixedRates,true);assert.equal(payrollEmployee?.effectiveRateCzk,'273.33');
  await request('/company-billing',{method:'PATCH',token:managerToken,body:{ico:'12345678',dic:'CZ12345678',address:'Finance Company, Praha',email:managerEmail}});
  await request('/tax-information',{method:'PATCH',token:employeeToken,body:{businessName:'Finance Employee OSVC',ico:'87654321',dic:'',address:'Finance Employee, Praha',iban:'CZ6508000000192000145399',dueDays:14,prefix:'FT'}});
  const preview=await request(`/invoices/preview?month=${invoiceMonth}`,{token:employeeToken});assert.equal(preview.preview?.totalHours,'15.00');assert.equal(preview.preview?.subtotal,'4100.00');assert.equal(preview.preview?.hourlyRate,'273.33');
  const created=await request('/invoices',{method:'POST',token:employeeToken,body:{month:invoiceMonth}});assert.equal(created.invoice?.totalHours,'15.00');assert.equal(created.invoice?.subtotal,'4100.00');assert.equal(created.invoice?.hourlyRate,'273.33');assert.deepEqual((created.invoice?.items||[]).map(item=>[item.hours,item.hourlyRate,item.amount]),[['4.00','250.00','1000.00'],['4.00','250.00','1000.00'],['7.00','300.00','2100.00']]);
  console.log('Finance E2E passed: multi-project lunch + historical rate snapshots -> payroll -> invoice');
}
main().catch(error=>{console.error(error instanceof Error?error.stack||error.message:String(error));process.exit(1)});
