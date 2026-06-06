export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();

  if(!process.env.PERPLEXITY_API_KEY){
    return res.status(500).json({error:'PERPLEXITY_API_KEY is not configured'});
  }

  const prompt=[
    '오늘 기준 최근 3개월 동안 삼성전자(005930) 주가와 직접 관련된 실제 뉴스/리포트/공시 이슈를 찾아줘.',
    '새 기사와 기존에 알려진 기사를 누적 저장할 수 있도록 publishedAt은 반드시 YYYY-MM-DD로 쓰고, month는 YYYY-MM로 써줘.',
    '기사 URL에는 실제 기사 원문 또는 실제 리포트/공시 URL만 넣어줘. 가짜 URL, 검색 URL, 홈 주소는 넣지 마.',
    '정렬은 날짜 오름차순으로 해줘. 새로운 연도/월 기사가 있으면 month 값으로 새 항목이 자동 추가되게 해줘.',
    '반드시 JSON만 반환해. 형식:',
    '{"articles":[{"title":"기사 제목","source":"매체","publishedAt":"YYYY-MM-DD","month":"YYYY-MM","sentiment":"긍정|중립|부정","summary":"줄바꿈 포함 5문장 이상 요약","url":"실제 기사 URL"}]}'
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
  const text=data.choices?.[0]?.message?.content||'{"articles":[]}';
  try{
    res.status(200).json(JSON.parse(text.replace(/^```json|```$/g,'').trim()));
  }catch(e){
    res.status(200).json({articles:[],raw:text});
  }
}
