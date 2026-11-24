import World from '../components/World';
import Lab from '../components/Lab';
import Twin from '../components/Twin';
import { experience, papers, skills, teaching } from '../components/data';
import { ArrowDown, ArrowUpRight, Flame, Github, Linkedin, Mail } from 'lucide-react';

export default function Home() {
  return (
    <>
      <World />
      <header>
        <nav className="nav" aria-label="Main">
          <a className="brand" href="#home">rivu<span>.</span></a>
          <div className="navlinks"><a href="#about">About</a><a href="#work">Work</a><a href="#research">Publications</a><a href="#skills">Skills</a><a href="#lab">Lab</a></div>
          <a className="navcta" href="#twin"><Flame size={15} /> Ask the phoenix</a>
        </nav>
      </header>

      <main>
        <section id="home" className="stop hero">
          <div className="herocopy">
            <h1>Rivujit Das</h1>
            <p className="lead">AI researcher and engineer working across multimodal learning, LLM systems and efficient inference.</p>
            <div className="actions">
              <a className="primary" href="#about">Follow the phoenix <ArrowDown size={17} /></a>
              <a className="secondary" href="#twin"><Flame size={16} /> Ask it anything</a>
            </div>
          </div>
        </section>

        <section id="about" className="stop left">
          <div className="panel">
            <h2>Curiosity is my constant</h2>
            <p>My journey spans multimodal learning and robotics research at NYU, efficient LLM inference at Arya.ai, multilingual NLP at PwC and data engineering at Presto Automation.</p>
            <dl className="education">
              <div><dt>New York University, Courant</dt><dd>M.S. Computer Science, 2024–2026. GPA 3.87/4.0</dd></div>
              <div><dt>IIEST Shibpur</dt><dd>B.S. Computer Science, 2020–2024. GPA 8.8/10, First Class</dd></div>
            </dl>
            <a className="textlink" href="https://github.com/DevRivu" target="_blank" rel="noreferrer">View GitHub <ArrowUpRight size={16} /></a>
          </div>
        </section>

        <section id="work" className="stop left">
          <div className="stack">
            <h2 className="onscene">Research meets the real world</h2>
            {experience.map((e) => (
              <article key={e.org} className="panel job">
                <div className="jobhead"><h3>{e.org}</h3><span>{e.date}</span></div>
                <p className="role">{e.role}</p>
                <ul>{e.points.map((p) => <li key={p}>{p}</li>)}</ul>
                <p className="result">{e.result}</p>
              </article>
            ))}
            <article className="panel job" id="teaching">
              <div className="jobhead"><h3>Teaching experience</h3></div>
              <p className="role">Teaching Assistant</p>
              <dl className="teaching">{teaching.map(([k, v]) => <div key={k}><dt>{k}</dt><dd><ul>{v.map((c) => <li key={c}>{c}</li>)}</ul></dd></div>)}</dl>
            </article>
          </div>
        </section>

        <section id="research" className="stop low">
          <h2 className="onscene">Publications</h2>
          <div className="papers">
            {papers.map((p) => (
              <article className="panel paper" key={p.title}>
                <img src={p.image} alt={p.alt} width="1280" height="720" loading="lazy" decoding="async" />
                <span className="year">{p.year}</span>
                <h3>{p.title}</h3>
                <p>{p.venue}</p>
                <a className="textlink" href={`https://scholar.google.com/scholar?q=${encodeURIComponent(p.title)}`} target="_blank" rel="noreferrer">Find publication <ArrowUpRight size={15} /></a>
              </article>
            ))}
          </div>
        </section>

        <section id="skills" className="stop right">
          <div className="panel">
            <h2>What I build with</h2>
            <dl className="skills">{skills.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v.join(', ')}</dd></div>)}</dl>
          </div>
        </section>

        <section id="lab" className="stop low">
          <h2 className="onscene">Ideas you can touch</h2>
          <Lab />
        </section>

        <section id="twin" className="stop right">
          <div className="twinbox">
            <h2 className="onscene">Ask the phoenix</h2>
            <Twin />
          </div>
        </section>

        <section id="contact" className="stop contact">
          <div>
            <h2 className="onscene">Let’s build something meaningful</h2>
            <div className="actions">
              <a className="primary" href="mailto:rd3681@nyu.edu"><Mail size={17} /> Get in touch</a>
              <a className="secondary" href="/resume.pdf" download>Download résumé <ArrowDown size={16} /></a>
            </div>
            <div className="social">
              <a href="https://github.com/DevRivu" target="_blank" rel="noreferrer"><Github size={20} /> GitHub</a>
              <a href="https://www.linkedin.com/in/drivujit" target="_blank" rel="noreferrer"><Linkedin size={20} /> LinkedIn</a>
            </div>
          </div>
        </section>
      </main>

      <footer><span>© {new Date().getFullYear()} Rivujit Das</span><a href="#home">Back to the start</a></footer>
    </>
  );
}
