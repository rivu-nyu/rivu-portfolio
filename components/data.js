const NYU = 'New York University, Courant Institute of Mathematical Sciences', IIEST = 'Indian Institute of Engineering Science and Technology, Shibpur';
export const education = [[NYU, 'M.S. Computer Science, 2024–2026'], [IIEST, 'B.S. Computer Science, 2020–2024, First Class']];
// refs point at entries of `papers` (1-based)
export const research = [
  { org: NYU, role: 'Graduate Researcher', date: 'Sept 2025 – May 2026', points: [
    ['Designed and ran experiments on how prompt composition affects LLM-based robotics decision-making.'],
    ['Analyzed transformer attention and applied spectral clustering to multimodal in-context learning demonstrations.'],
    ['Developed a representation intervention method to evaluate cross-task generalization, observing significant performance variance in multi-task settings (3+ tasks).'],
  ], result: 'Up to 60% task success while reducing prompt size.' },
  { org: IIEST, role: 'Undergraduate Researcher, Trustworthy News and Bias Mitigation', points: [
    ['Studied ideological bias in news, especially bias by word choice: detecting slanted reporting and rewriting it neutrally without losing the facts.', 1, 2],
    ['Co-authored a deep learning framework that classifies and mitigates bias in news reporting, published at the Future Technologies Conference 2024.', 2],
    ['Co-developed CANDOR, a multimodal framework joining ideology-aware text with visual and textual context, through the BIASLENS pre-training objective and the VT-CT vision-text transformer.', 1],
    ['Improved accuracy by 4–13% and content preservation by 1–12% on benchmarks such as AllSides, with human evaluation confirming neutral, readable rewrites.', 1],
  ] },
];
export const experience = [
  { org: 'Arya.ai', role: 'Machine Learning Research Scientist Intern', date: 'May – July 2024', points: [
    'Built an end-to-end LLM compression and inference pipeline using GPTQ, AWQ and INT8 quantization.',
    'Developed embedding alignment and semantic-consistency metrics to quantify drift between FP16 and quantized models.',
  ], result: 'Up to 20% higher throughput and 12% lower VRAM consumption.' },
  { org: 'PwC', role: 'Machine Learning Intern', date: 'May – July 2023', points: [
    'Built a multilingual BERT-based NLP pipeline for international tax documents.',
    'Fine-tuned classification and semantic-matching models and integrated them into a chatbot-assisted workflow.',
  ], result: '91% classification accuracy; 2,000+ user queries supported across 500+ recurring issue types.' },
  { org: 'Presto Automation', role: 'Software Engineering Intern', date: 'May – July 2022', points: [
    'Built a customer analytics pipeline with MySQL and Python, clustering users into actionable segments.',
    'Developed ARIMA demand forecasts and an interactive analytics dashboard.',
  ], result: 'Improved visibility into demand trends and anomalies.' },
];
export const scholar = 'https://scholar.google.com/citations?user=bbjo5McAAAAJ&hl=en';
export const papers = [
  { year: '2026', venue: 'ACM Transactions on Knowledge Discovery from Data, 20(3)', doi: '10.1145/3789258', title: 'Breaking Bias: A Context-Aware Multimodal Framework for Detecting and Neutralizing Ideological Bias in News', image: '/publications/neutralizing-bias.webp', alt: 'Illustration: a news page with loaded wording and a flagged photo passes through a glowing ring and comes out neutral' },
  { year: '2024', venue: 'Springer, Proceedings of the Future Technologies Conference 2024', doi: '10.1007/978-3-031-73125-9_27', title: 'A Deep Learning Framework for Classifying and Mitigating Bias in News Reporting', image: '/publications/trustworthy-news.webp', alt: 'Illustration: two news stories weighed on a brass balance in front of a neural network inside a glowing shield' },
];
export const teaching = [
  ['Graduate courses', ['Reinforcement Learning', 'Deep Learning', 'Natural Language Processing']],
  ['Undergraduate course', ['Algorithmic Computer Science']],
];
export const skills = [
  ['Languages', ['Python', 'C', 'C++17', 'Java', 'SQL', 'JavaScript']],
  ['ML frameworks', ['PyTorch', 'TensorFlow', 'Keras', 'scikit-learn', 'XGBoost', 'Hugging Face Transformers']],
  ['Data and ML tools', ['Pandas', 'NumPy', 'Matplotlib', 'Seaborn', 'Plotly', 'Jupyter', 'MLflow', 'Weights & Biases']],
  ['Systems', ['Linux', 'Docker', 'Git', 'System design', 'Inference pipelines', 'Performance optimization', 'Benchmarking']],
];
export const interests = [
  ['Large language models', 'Compression and faster inference with GPTQ, AWQ and INT8 at Arya.ai'],
  ['Multimodal learning', 'CANDOR, joining text and images to find bias in news'],
  ['In-context learning', 'Choosing better demonstrations for robotics prompts at NYU'],
  ['Representation learning', 'Intervening on representations to test cross-task generalization'],
  ['Attention mechanisms', 'Reading attention patterns to shrink prompts without losing success'],
];
export const knowledge = `Rivujit Das is an AI researcher and engineer. Education: ${JSON.stringify(education)} Research experience: ${JSON.stringify(research)} Professional experience: ${JSON.stringify(experience)} Teaching assistant for: ${JSON.stringify(teaching)} Publications: ${JSON.stringify(papers.map(({ year, venue, title, doi }) => ({ year, venue, title, doi })))} Skills: ${JSON.stringify(skills)} Research interests: ${JSON.stringify(interests)} GitHub: DevRivu. LinkedIn: drivujit. Email: rd3681@nyu.edu.`;

// Offline answers, used when no AI endpoint is configured. The best-scoring topic wins.
const topics = [
  [/\b(interests?|interested|focus|passion\w*|curious)\b/g, 'Rivujit is most drawn to large language models, multimodal learning, in-context learning, representation learning and attention mechanisms.'],
  [/\b(teach\w*|taught|tas?|assistants?|courses?|class(es)?|tutor\w*|reinforcement|algorithm\w*|deep learning|natural language)\b/g, 'Rivujit has been a teaching assistant for three graduate courses, Reinforcement Learning, Deep Learning and Natural Language Processing, and for the undergraduate course Algorithmic Computer Science.'],
  [/\b(education|degree|masters?|bachelors?|college|university|stud(y|ied)|school|iiest|shibpur|courant)\b/g, 'Rivujit earned an M.S. in Computer Science at New York University, Courant Institute of Mathematical Sciences (2024–2026), and a B.S. in Computer Science at the Indian Institute of Engineering Science and Technology, Shibpur (2020–2024, First Class).'],
  [/\b(nyu|robot\w*|attention|prompt\w*|spectral|in-context|graduate|research(ed)?)\b/g, 'At NYU, Rivujit studied how prompt composition shapes LLM-based robotics decisions. The work used transformer attention analysis and spectral clustering to choose in-context demonstrations, shrinking prompts while reaching up to 60% task success. It also included a representation intervention method for testing cross-task generalization.'],
  [/\b(arya\S*|quanti\w*|gptq|awq|int8|compress\w*|inference|optimi\w*|vram|throughput|llms?)\b/g, 'At Arya.ai, Rivujit built an LLM compression and inference pipeline with GPTQ, AWQ and INT8. It raised throughput by up to 20% and cut VRAM use by 12%, with embedding-alignment metrics to catch drift between FP16 and quantized models.'],
  [/\b(pwc|pricewaterhouse\w*|tax|multilingual|bert|nlp|chatbot)\b/g, 'At PwC, Rivujit built a multilingual BERT pipeline for international tax documents. It reached 91% accuracy and fed a chatbot workflow supporting 2,000+ user queries.'],
  [/\b(presto\w*|arima|forecast\w*|dashboard|mysql|analytics)\b/g, 'At Presto Automation, Rivujit built a customer analytics pipeline in MySQL and Python, ARIMA demand forecasts, and an interactive dashboard for trends and anomalies.'],
  [/\b(papers?|publi\w*|bias\w*|news|tkdd|acm|springer|candor|biaslens|allsides|trustworthy|undergrad\w*|thesis)\b/g, 'Two publications, both on ideological bias in news. “Breaking Bias” (ACM TKDD, 2026) introduces CANDOR, a multimodal framework that detects slanted wording and rewrites it neutrally, improving accuracy by 4–13%. The earlier paper (Springer, FTC 2024) is a deep learning framework for classifying and mitigating bias in news reporting.'],
  [/\b(skills?|languages?|python|pytorch|java|frameworks?|tools?|stack|tech\w*)\b/g, 'Rivujit works in Python, C, C++17, Java, SQL and JavaScript, with PyTorch, TensorFlow, Keras, scikit-learn and Hugging Face, plus Docker, Linux, MLflow and Weights & Biases.'],
  [/\b(contact|e-?mail|hire|hiring|reach|linkedin|github)\b/g, 'You can reach Rivujit at rd3681@nyu.edu, on LinkedIn at linkedin.com/in/drivujit, or on GitHub at github.com/DevRivu.'],
  [/\b(experience|jobs?|intern\w*|work(ed)?|career|compan\w*)\b/g, 'Research: graduate researcher at NYU Courant (2025–2026) and undergraduate research on trustworthy news at IIEST Shibpur. Professional: ML research scientist intern at Arya.ai (2024), ML intern at PwC (2023) and software engineering intern at Presto Automation (2022). Ask me about any one of them.'],
  [/\b(who|about|yourself|rivu|rivujit|hello|hi|hey)\b/g, 'I am the phoenix of this valley, an AI guide to the work of Rivujit Das, an AI researcher and engineer focused on multimodal learning, LLM systems and efficient inference.'],
];
export function localAnswer(q) {
  q = q.toLowerCase(); let best = 0, out = null;
  for (const [re, text] of topics) { const n = (q.match(re) || []).length; if (n > best) { best = n; out = text; } }
  return out || 'I don’t have that one. I can tell you about Rivujit’s education, NYU research, Arya.ai, PwC, Presto, teaching, publications, skills, or how to get in touch.';
}
