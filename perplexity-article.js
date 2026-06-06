export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});

  if(!process.env.ANTHROPIC_API_KEY){
    return res.status(500).json({error:'ANTHROPIC_API_KEY is not configured'});
  }

  const body=req.body||{};
  const news=(body.news||[]).slice(-80).map(n=>({
    title:n.title,
    source:n.source,
    publishedAt:n.publishedAt,
    sentiment:n.sentiment,
    summary:n.summary,
    url:n.url
  }));
  const prompt=[
    '너는 한국 주식 시장을 분석하는 애널리스트다.',
    '삼성전자(005930)에 대해 Claude 자체 웹 검색, 아래 최근 3개월 뉴스 목록, 실제 가격/기술지표 데이터를 함께 사용해 분석하라.',
    '투자 조언처럼 단정하지 말고 가능성과 리스크를 균형 있게 써라.',
    '반드시 JSON만 반환하라. 형식:',
    '{"title":"짧은 제목","sentiment":"긍정|중립|부정","confidence":"높음|보통|낮음","score":0-100,"summary":"5문장 이상 한국어 분석. 줄바꿈 가능","sources":[{"title":"출처명","url":"https://..."}]}',
    '',
    '실제 가격/기술지표 데이터:',
    JSON.stringify({stock:body.stock,indicators:body.indicators},null,2),
    '',
    '뉴스 현황 분석 최근 3개월 데이터:',
    JSON.stringify(news,null,2)
  ].join('\n');

  const r=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{
      'x-api-key':process.env.ANTHROPIC_API_KEY,
      'anthropic-version':'2023-06-01',
      'content-type':'application/json'
    },
    body:JSON.stringify({
      model:process.env.CLAUDE_MODEL||'claude-sonnet-4-6',
      max_tokens:1800,
      temperature:0.2,
      tools:[{
        type:'web_search_20250305',
        name:'web_search',
        max_uses:5,
        user_location:{type:'approximate',city:'Seoul',region:'Seoul',country:'KR',timezone:'Asia/Seoul'}
      }],
      messages:[{role:'user',content:prompt}]
    })
  });

  const data=await r.json();
  if(!r.ok){
    return res.status(r.status).json({error:data.error?.message||'Claude API request failed',raw:data});
  }

  const text=(data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n').trim();
  const citations=[];
  for(const block of data.content||[]){
    if(block.type==='text'&&Array.isArray(block.citations)){
      for(const c of block.citations){
        if(c.url)citations.push({title:c.title||c.url,url:c.url});
      }
    }
  }

  try{
    const json=JSON.parse(text.replace(/^```json|```$/g,'').trim());
    const seen=new Set((json.sources||[]).map(s=>s.url));
    json.sources=[...(json.sources||[]),...citations.filter(s=>!seen.has(s.url))].slice(0,8);
    return res.status(200).json(json);
  }catch(e){
    return res.status(200).json({
      title:'Claude 분석 결과',
      sentiment:'중립',
      confidence:'보통',
      score:50,
      summary:text||'Claude 분석 결과를 읽을 수 없습니다.',
      sources:citations.slice(0,8)
    });
  }
}
