import World from '../components/World';
import Music from '../components/Music';
import Lab from '../components/Lab';
import Twin from '../components/Twin';
import { scholar, education, interests, research, experience, papers, skills, teaching } from '../components/data';
import { ArrowDown, ArrowUpRight, Flame, Github, Linkedin, Mail } from 'lucide-react';

const mark = (d) => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d={d} /></svg>;
const profiles = [
  ['LinkedIn', 'https://www.linkedin.com/in/drivujit', mark('M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z')],
  ['GitHub', 'https://github.com/DevRivu', mark('M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12')],
  ['Google Scholar', scholar, mark('M5.242 13.769L0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z')],
];

export default function Home() {
  return (
    <>
      <World />
      <header>
        <nav className="nav" aria-label="Main">
          <a className="brand" href="#home">rivu<span>.</span></a>
          <div className="navlinks"><a href="#about">About</a><a href="#labs">Research</a><a href="#work">Work</a><a href="#research">Publications</a><a href="#skills">Skills</a><a href="#lab">Lab</a></div>
          <div className="navend"><Music /><a className="navcta" href="#twin"><Flame size={15} /> Ask the phoenix</a></div>
        </nav>
      </header>

      <main>
        <section id="home" className="stop hero">
          <div className="herocopy">
            <h1>Rivujit Das</h1>
            <p className="lead">AI researcher and engineer working across multimodal learning, LLM systems and efficient inference.</p>
            <div className="actions">
              <nav className="sigils" aria-label="Profiles">
                {profiles.map(([label, href, icon]) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}><i>{icon}</i><span>{label}</span></a>)}
              </nav>
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

        <div className="ashes" aria-hidden="true" />

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
