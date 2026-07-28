import React from 'react';
import { FaTwitter, FaGithub, FaLinkedin } from 'react-icons/fa';
import { LogoFull } from './Logo';

export default function Footer() {
  return (
    <footer className="w-full bg-[#030712] border-t border-white/5 py-12 px-6 mt-auto">
      <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
        <LogoFull iconSize={30} />


        <p className="text-sm text-gray-500 text-center md:text-left">
          &copy; {new Date().getFullYear()} InterviewIQ. Built for interview prep.
        </p>

        <div className="flex items-center gap-4 text-gray-400">
          <a href="#" className="hover:text-white transition duration-200"><FaTwitter size={18} /></a>
          <a href="https://github.com/AkkiSensei/InterviewIQ" target="_blank" rel="noopener noreferrer" className="hover:text-white transition duration-200"><FaGithub size={18} /></a>
          <a href="#" className="hover:text-white transition duration-200"><FaLinkedin size={18} /></a>
        </div>
      </div>
    </footer>
  );
}
