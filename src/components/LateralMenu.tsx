/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GENRES, CATEGORIES, AMBIANCES, FORMATS, LANGUAGES } from '../data';
import Logo from './Logo';
import {
  BookOpen,
  Layers,
  Sparkles,
  Clock,
  Globe,
  Crown,
  HelpCircle,
  LogOut,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface LateralMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onFilterSelect: (type: 'genre' | 'category' | 'ambiance' | 'format' | 'language' | 'ranking', value: string) => void;
  activeFilter: { type: string; value: string } | null;
  onLogout: () => void;
}

type CollapsibleSection = 'genre' | 'category' | 'ambiance' | 'format' | 'language';

export default function LateralMenu({
  isOpen,
  onClose,
  onFilterSelect,
  activeFilter,
  onLogout
}: LateralMenuProps) {
  const [openSections, setOpenSections] = useState<Record<CollapsibleSection, boolean>>({
    genre: true,
    category: false,
    ambiance: false,
    format: false,
    language: false
  });

  const toggleSection = (section: CollapsibleSection) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleLanguageChange = (language: string) => {
    localStorage.setItem('plume_app_language', language);

    window.dispatchEvent(
      new CustomEvent('plume-language-change', {
        detail: { language }
      })
    );

    onFilterSelect('language', language);
    onClose();
  };

  const sections = [
    {
      title: 'Genres',
      icon: <BookOpen className="w-4 h-4 text-purple-500" />,
      items: GENRES,
      type: 'genre' as const
    },
    {
      title: 'Catégories',
      icon: <Layers className="w-4 h-4 text-purple-500" />,
      items: CATEGORIES,
      type: 'category' as const
    },
    {
      title: 'Ambiances',
      icon: <Sparkles className="w-4 h-4 text-purple-500" />,
      items: AMBIANCES,
      type: 'ambiance' as const
    },
    {
      title: 'Formats',
      icon: <Clock className="w-4 h-4 text-purple-500" />,
      items: FORMATS,
      type: 'format' as const
    },
    {
      title: 'Langues',
      icon: <Globe className="w-4 h-4 text-purple-500" />,
      items: LANGUAGES,
      type: 'language' as const
    }
  ];

  return (
    <>
      {/* Background Overlay */}
      {isOpen && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`absolute inset-y-0 left-0 w-72 bg-white dark:bg-[#0E0E14] border-r border-[#ecebf6] dark:border-purple-900/15 z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header / Brand */}
        <div className="flex items-center justify-between p-6 border-b border-[#ecebf6] dark:border-purple-900/15">
          <Logo size="md" showText={true} />
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Filters */}
        <div className="p-4 space-y-6">
          {/* Rankings Quick Filter */}
          <div>
            <div className="flex items-center space-x-2 px-3 mb-2 text-xs font-bold tracking-widest text-purple-600 dark:text-purple-400 uppercase">
              <Crown className="w-3.5 h-3.5" />
              <span>Classements</span>
            </div>
            <div className="space-y-1">
              {[
                { name: 'Top Lectures', val: 'reads' },
                { name: 'Top Favoris', val: 'favorites' },
                { name: 'Tendance de la semaine', val: 'trending' }
              ].map((r) => {
                const isSelected = activeFilter?.type === 'ranking' && activeFilter?.value === r.val;
                return (
                  <button
                    key={r.val}
                    id={`ranking-btn-${r.val}`}
                    onClick={() => {
                      onFilterSelect('ranking', r.val);
                      onClose();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-l-2 border-purple-600'
                        : 'text-[#1F2937] dark:text-[#F5F5F5] hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Regular filters */}
          {sections.map((section) => {
            const isOpenSection = openSections[section.type];

            return (
              <div key={section.title} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSection(section.type)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase hover:bg-gray-50 dark:hover:bg-purple-950/20 transition-colors"
                  aria-expanded={isOpenSection}
                >
                  <span className="flex items-center space-x-2">
                    {section.icon}
                    <span>{section.title}</span>
                  </span>

                  {isOpenSection ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isOpenSection && (
                  <div className="space-y-1 pl-1 animate-slide-down">
                    {section.items.map((item) => {
                      const isSelected = activeFilter?.type === section.type && activeFilter?.value === item;

                      return (
                        <button
                          key={item}
                          id={`filter-btn-${section.type}-${item.replace(/\s+/g, '-')}`}
                          onClick={() => {
                            if (section.type === 'language') {
                              handleLanguageChange(item);
                              return;
                            }

                            onFilterSelect(section.type, item);
                            onClose();
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all truncate ${
                            isSelected
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/45 dark:text-purple-300 border-l-2 border-purple-500'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-purple-950/20'
                          }`}
                          title={item}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer actions inside the drawer */}
        <div className="p-4 border-t border-[#ecebf6] dark:border-purple-900/15 mt-auto bg-gray-50/50 dark:bg-black">
          <div className="space-y-1">
            <button
              id="sidebar-help-btn"
              onClick={() => {
                onFilterSelect('ranking', 'reads');
                alert('Aide: Bienvenue sur PLUME! Pour toute question ou assistance, veuillez contacter support@plume.fr ou consulter notre documentation.');
                onClose();
              }}
              className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-gray-500" />
              <span>Aide & Support</span>
            </button>
            <button
              id="sidebar-logout-btn"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-500/5 dark:hover:bg-purple-950/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Déconnexion</span>
            </button>
          </div>
          <div className="mt-4 text-center">
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 block">
              PLUME Littéraire v1.0
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
