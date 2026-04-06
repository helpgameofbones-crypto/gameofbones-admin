'use client'
import { useEffect, useState } from 'react'

export default function ProductPerformancePage() {
  const [data, setData] = useState<any>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [days])

  async function fetchData() {
    setLoading(true)
    const res = await fetch(`/api/product-performance?days=${days}`)
    setData(await res.json())
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#f9f6f2',fontFamily:'Inter,sans-serif'}}>
      <div style={{background:'#1a1008',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontWeight:700,color:'#c8973a',fontSize:18}}>Game of Bones — Product Performance</div>
        <select value={days} onChange={e=>setDays(Number(e.target.value))} style={{padding:'7px 14px',borderRadius:8,fontSize:13,border:'none'}}>
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option>
        </select>
      </div>

      <div style={{padding:'32px 24px',maxWidth:1100,margin:'0 auto'}}>
        {loading ? <div style={{textAlign:'center',padding:60,color:'#8a7a6a'}}>Loading...</div> : data && (<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
            {[
              {label:'Total Revenue',value:`₹${data.totalRevenue?.toLocaleString('en-IN')}`,color:'#c8973a'},
              {label:'Units Sold',value:data.totalUnits?.toLocaleString('en-IN'),color:'#1a1008'},
              {label:'Orders',value:data.ordersCount,color:'#2a7c6f'},
            ].map(({label,value,color})=>(
              <div key={label} style={{background:'white',borderRadius:12,padding:'20px 24px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#8a7a6a',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>{label}</div>
                <div style={{fontSize:28,fontWeight:800,color}}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#f9f6f2',borderBottom:'1px solid #e5ddd0'}}>
                {['Product','Units Sold','Revenue','Margin','Stock','Status'].map(h=>(
                  <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:'#8a7a6a',textTransform:'uppercase',letterSpacing:'.08em'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{data.report?.map((p:any,i:number)=>(
                <tr key={p.name} style={{borderBottom:'1px solid #f0ebe3',background:i%2===0?'white':'#fafafa'}}>
                  <td style={{padding:'12px 16px',fontWeight:600,color:'#1a1008',fontSize:14}}>{p.name}</td>
                  <td style={{padding:'12px 16px',fontSize:14,color:'#1a1008'}}>{p.units_sold}</td>
                  <td style={{padding:'12px 16px',fontWeight:700,color:'#c8973a',fontSize:14}}>₹{p.revenue?.toLocaleString('en-IN')}</td>
                  <td style={{padding:'12px 16px',fontSize:14}}>
                    {p.margin!==null ? <span style={{color:p.margin>=50?'#16a34a':p.margin>=30?'#d97706':'#dc2626',fontWeight:700}}>{p.margin}%</span> : <span style={{color:'#8a7a6a'}}>—</span>}
                  </td>
                  <td style={{padding:'12px 16px',fontSize:14,fontWeight:700,color:p.stock===0?'#dc2626':p.low_stock?'#d97706':'#16a34a'}}>{p.stock}</td>
                  <td style={{padding:'12px 16px'}}>
                    {p.out_of_stock ? <span style={{background:'#fee2e2',color:'#dc2626',padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:700}}>Out of Stock</span>
                    : p.low_stock ? <span style={{background:'#fef9c3',color:'#d97706',padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:700}}>Low Stock</span>
                    : p.units_sold===0 ? <span style={{background:'#f3f4f6',color:'#6b7280',padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:700}}>No Sales</span>
                    : <span style={{background:'#dcfce7',color:'#16a34a',padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:700}}>Active</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>)}
      </div>
    </div>
  )
}