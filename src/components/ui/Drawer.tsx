import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function Drawer({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  width = "480px" 
}: DrawerProps) {
  // Prevent scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-[100] backdrop-blur-[2px]"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed right-0 top-0 h-full bg-white z-[101] shadow-2xl flex flex-col",
              "w-full" // width controlled via inline style
            )}
            style={{
              maxWidth: '100vw',
              width: `min(${width}, 100vw)`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <button 
                  onClick={onClose}
                  className="p-2 -ml-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-lg md:text-xl font-bold text-gray-900">{title}</h2>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
