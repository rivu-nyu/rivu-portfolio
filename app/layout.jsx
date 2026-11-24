import { Marcellus, Figtree } from 'next/font/google';
import './globals.css';

const display = Marcellus({ weight: '400', subsets: ['latin'], variable: '--display' });
const text = Figtree({ subsets: ['latin'], variable: '--text-face' });

export const metadata = { title: 'Rivujit Das — AI Research & Engineering', description: 'Exploring intelligence through research, experimentation and engineering.' };
export const viewport = { themeColor: '#140d0c' };
export default function Layout({ children }) { return <html lang="en" className={`${display.variable} ${text.variable}`}><body>{children}</body></html>; }
