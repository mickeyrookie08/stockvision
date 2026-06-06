export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();

  if(!process.env.PERPLEXITY_API_KEY){
    return res.status(500).json({error:'PERPLEXITY_API_KEY is not configured'});
  }

  const title=req.query.title||'삼성전자 주가 관련 뉴스';
  const prompt=[
    `기사 제목: ${title}`,
    '이 기사가 삼성전자 주가에 미칠 영향을 검색 기반으로 분석해줘.',
    '반드시 JSON만 반환해. 형식:',
    '{"title":"기사 제목","sentiment":"긍정|중립|부정","summary":"기사 요약과 주가 영향 분석을 줄바꿈 포함 5문장 이상으로 작성","url":"가장 관련 있는 출처 URL"}'
  ].join('\n');

  const r=await fetch('https://api.perplexity.ai/chat/completions',{
    method:'POST',
    headers:{
      'Authorization':`Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({
      model:'sonar',
      messages:[{role:'user',content:prompt}],
      temperature:0.2
    })
  });

  const data=await r.json();
  const text=data.choices?.[0]?.message?.content||'{}';
  try{
    res.status(200).json(JSON.parse(text.replace(/^```json|```$/g,'').trim()));
  }catch(e){
    res.status(200).json({title,sentiment:'중립',summary:text,url:''});
  }
}
