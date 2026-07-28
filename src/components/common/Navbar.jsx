import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowRight, FaGithub } from 'react-icons/fa';
import { LogoFull } from './Logo';
import { useInterview } from '../../context/InterviewContext';
import Button from '../ui/Button';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const { isAuthenticated, user, logoutMock } = useInterview();

  const links = [
    { name: 'Features', href: '#features' },
    { name: 'Domains', href: '#domains' },
    { name: 'How It Works', href: '#how-it-works' },
  ];

  const handleNavClick = (e, href) => {
    if (path === '/') {
      e.preventDefault();
      const element = document.getElementById(href.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full px-4 pt-4 pb-2 bg-[#030712]/80 backdrop-blur-md">
      <nav className="mx-auto max-w-7xl h-16 rounded-2xl bg-[#111827]/40 backdrop-blur-md px-6 flex items-center justify-between border border-white/5 shadow-2xl">
        <Link to="/" className="hover:opacity-90 transition duration-200">
          <LogoFull />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="text-sm font-medium text-gray-400 hover:text-white transition duration-200"
            >
              {link.name}
            </a>
          ))}
          <a
            href="https://github.com/AkkiSensei/InterviewIQ"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition duration-200 flex items-center gap-1.5 text-sm font-medium"
          >
            <FaGithub />
            <span>GitHub</span>
          </a>
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/app/dashboard')}
            variant="primary"
            size="sm"
            className="group h-9"
          >
            <span>Start Preparing</span>
            <FaArrowRight className="text-xs group-hover:translate-x-1 transition duration-200" />
          </Button>

          {isAuthenticated ? (
            <>
              {/* User Profile Avatar Badge */}
              <Link
                to="/app/dashboard"
                className="relative group h-9 w-9 rounded-xl flex items-center justify-center p-[1px] bg-gradient-to-tr from-primary to-accent hover:shadow-lg hover:shadow-primary/25 hover:shadow-indigo-500/20 transition-all duration-300 active:scale-95"
                title="View Dashboard"
              >
                <div className="h-full w-full rounded-[11px] overflow-hidden bg-[#030712] p-[1.5px]">
                  <img
                    src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120"}
                    alt="Profile"
                    className="h-full w-full rounded-[10px] object-cover group-hover:scale-105 transition duration-200"
                  />
                </div>
                {/* Pulsing online status indicator */}
                <span className="absolute bottom-[-1.5px] right-[-1.5px] h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#030712] shadow-sm animate-pulse" />
              </Link>

              {/* Log Out button */}
              <button
                onClick={() => {
                  logoutMock();
                  navigate('/');
                }}
                className="px-3.5 h-9 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition duration-200 cursor-pointer flex items-center justify-center"
              >
                Log Out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-[#111827]/40 hover:bg-white/5 text-xs font-semibold text-gray-300 hover:text-white transition duration-200 shadow-md"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
