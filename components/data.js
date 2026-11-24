export const experience = [
  { org: 'New York University', role: 'Graduate Researcher', date: 'Sept 2025 – May 2026', points: [
    'Designed and ran experiments on how prompt composition affects LLM-based robotics decision-making.',
    'Analyzed transformer attention and applied spectral clustering to multimodal in-context learning demonstrations.',
    'Developed a representation intervention method to evaluate cross-task generalization, observing significant performance variance in multi-task settings (3+ tasks).',
  ], result: 'Up to 60% task success while reducing prompt size.' },
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
export const papers = [
  { year: '2025', venue: 'ACM Transactions on Knowledge Discovery from Data · Accepted, in press', title: 'Breaking Bias: A Context-Aware Multimodal Framework for Detecting and Neutralizing Ideological Bias in News' },
  { year: '2024', venue: 'Springer · Future Technologies, 9th International Conference', title: 'A Deep Learning Framework for Classifying and Mitigating Bias in News Reporting' },
];
export const skills = [
  ['Languages', ['Python', 'C', 'C++17', 'Java', 'SQL', 'JavaScript']],
  ['ML frameworks', ['PyTorch', 'TensorFlow', 'Keras', 'scikit-learn', 'XGBoost', 'Hugging Face Transformers']],
  ['Data and ML tools', ['Pandas', 'NumPy', 'Matplotlib', 'Seaborn', 'Plotly', 'Jupyter', 'MLflow', 'Weights & Biases']],
  ['Systems', ['Linux', 'Docker', 'Git', 'System design', 'Inference pipelines', 'Performance optimization', 'Benchmarking']],
  ['Focus', ['LLMs', 'Multimodal learning', 'In-context learning', 'Representation learning', 'Quantization', 'Attention mechanisms']],
];
export const knowledge = `Rivujit Das is an AI researcher and engineer. MS Computer Science, NYU Courant, Sept 2024–May 2026, GPA 3.87/4.0. BS Computer Science, IIEST Shibpur, 2020–2024, GPA 8.8/10. Experience: ${JSON.stringify(experience)} Publications: ${JSON.stringify(papers)} Skills: ${JSON.stringify(skills)} GitHub: DevRivu. LinkedIn: drivujit. Email: rd3681@nyu.edu.`;

// Offline answers, used when no AI endpoint is configured. The best-scoring topic wins.
const topics = [
  [/\b(gpa|education|degree|masters?|bachelors?|college|university|stud(y|ied)|school|iiest|shibpur|courant)\b/g, 'Rivujit earned an M.S. in Computer Science at NYU Courant (2024–2026, GPA 3.87/4.0) and a B.S. in Computer Science at IIEST Shibpur (2020–2024, GPA 8.8/10, First Class).'],
  [/\b(nyu|robot\w*|attention|prompt\w*|spectral|in-context|graduate|research(ed)?)\b/g, 'At NYU, Rivujit studied how prompt composition shapes LLM-based robotics decisions. The work used transformer attention analysis and spectral clustering to choose in-context demonstrations, shrinking prompts while reaching up to 60% task success. It also included a representation intervention method for testing cross-task generalization.'],
  [/\b(arya\S*|quanti\w*|gptq|awq|int8|compress\w*|inference|optimi\w*|vram|throughput|llms?)\b/g, 'At Arya.ai, Rivujit built an LLM compression and inference pipeline with GPTQ, AWQ and INT8. It raised throughput by up to 20% and cut VRAM use by 12%, with embedding-alignment metrics to catch drift between FP16 and quantized models.'],
  [/\b(pwc|pricewaterhouse\w*|tax|multilingual|bert|nlp|chatbot)\b/g, 'At PwC, Rivujit built a multilingual BERT pipeline for international tax documents. It reached 91% accuracy and fed a chatbot workflow supporting 2,000+ user queries.'],
  [/\b(presto\w*|arima|forecast\w*|dashboard|mysql|analytics)\b/g, 'At Presto Automation, Rivujit built a customer analytics pipeline in MySQL and Python, ARIMA demand forecasts, and an interactive dashboard for trends and anomalies.'],
  [/\b(papers?|publi\w*|bias|news|tkdd|acm|springer)\b/g, 'Two publications, both on ideological bias in news: “Breaking Bias” (ACM TKDD, 2025, accepted and in press on the résumé) and “A Deep Learning Framework for Classifying and Mitigating Bias in News Reporting” (Springer, 2024).'],
  [/\b(skills?|languages?|python|pytorch|java|frameworks?|tools?|stack|tech\w*)\b/g, 'Rivujit works in Python, C, C++17, Java, SQL and JavaScript, with PyTorch, TensorFlow, Keras, scikit-learn and Hugging Face, plus Docker, Linux, MLflow and Weights & Biases.'],
  [/\b(contact|e-?mail|hire|hiring|reach|linkedin|github)\b/g, 'You can reach Rivujit at rd3681@nyu.edu, on LinkedIn at linkedin.com/in/drivujit, or on GitHub at github.com/DevRivu.'],
  [/\b(experience|jobs?|intern\w*|work(ed)?|career|compan\w*)\b/g, 'Graduate researcher at NYU (2025–2026), ML research scientist intern at Arya.ai (2024), ML intern at PwC (2023) and software engineering intern at Presto Automation (2022). Ask me about any one of them.'],
  [/\b(who|about|yourself|rivu|rivujit|hello|hi|hey)\b/g, 'I am the phoenix of this valley, an AI guide to the work of Rivujit Das, an AI researcher and engineer focused on multimodal learning, LLM systems and efficient inference.'],
];
export function localAnswer(q) {
  q = q.toLowerCase(); let best = 0, out = null;
  for (const [re, text] of topics) { const n = (q.match(re) || []).length; if (n > best) { best = n; out = text; } }
  return out || 'I don’t have that one. I can tell you about Rivujit’s education, NYU research, Arya.ai, PwC, Presto, publications, skills, or how to get in touch.';
}
