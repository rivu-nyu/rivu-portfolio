import World from '../components/World';
import Lab from '../components/Lab';
import Twin from '../components/Twin';
import { education, interests, research, experience, papers, skills, teaching } from '../components/data';
import { ArrowDown, ArrowUpRight, Flame, Github, Linkedin, Mail } from 'lucide-react';

export default function Home() {
  return (
    <>
      <World />
      <header>
        <nav className="nav" aria-label="Main">
          <a className="brand" href="#home">rivu<span>.</span></a>
          <div className="navlinks"><a href="#about">About</a><a href="#labs">Research</a><a href="#work">Work</a><a href="#research">Publications</a><a href="#skills">Skills</a><a href="#lab">Lab</a></div>
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
            <a className="textlink" href="https://github.com/DevRivu" target="_blank" rel="noreferrer">View GitHub <ArrowUpRight size={16} /></a>
          </div>
        </section>

        <section id="education" className="stop right">
          <div className="panel">
            <h2>Education</h2>
            <dl className="education">{education.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </div>
        </section>

        <section id="labs" className="stop right">
          <div className="stack">
            <h2 className="onscene">Research experience</h2>
            {research.map((e) => (
              <article key={e.org} className="panel job">
                <h3 className="longname">{e.org}</h3>
                <p className="role">{e.role}{e.date && <span>{e.date}</span>}</p>
                <ul>{e.points.map(([text, ...refs]) => <li key={text}>{text}{refs.map((n) => <a className="cite" key={n} href={`https://doi.org/${papers[n - 1].doi}`} target="_blank" rel="noreferrer" aria-label={`Reference ${n}: ${papers[n - 1].title}`}>[{n}]</a>)}</li>)}</ul>
                {e.result && <p className="result">{e.result}</p>}
                {!e.result && <p className="refs">{papers.map((p, i) => <a key={p.doi} href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">[{i + 1}] {p.title.split(':')[0]}, {p.year}</a>)}</p>}
              </article>
            ))}
          </div>
        </section>

        <section id="work" className="stop left">
          <div className="stack">
            <h2 className="onscene">Professional experience</h2>
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

        <section id="research" className="stop right">
          <div className="panel pubs">
            <h2>Publications</h2>
            {papers.map((p) => (
              <article className="paper" key={p.title}>
                <img src={p.image} alt={p.alt} width="1280" height="720" loading="lazy" decoding="async" />
                <div>
                  <h3>{p.title}</h3>
                  <p><span className="year">{p.year}</span> {p.venue}</p>
                  <a className="textlink" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" aria-label={`Read publication: ${p.title}`}>Read publication <ArrowUpRight size={15} /></a>
                </div>
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

        <section id="interests" className="stop left">
          <div className="panel">
            <h2>What draws me in</h2>
            <dl className="skills">{interests.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </div>
        </section>

        <section id="lab" className="stop left">
          <div className="stack labs">
            <h2 className="onscene">Ideas you can touch</h2>
            <Lab />
          </div>
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
