import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import {
  formatThaiDate,
  toBuddhistYear,
  toGregorianYear,
  THAI_MONTH_NAMES,
  THAI_MONTH_NAMES_SHORT,
  THAI_WEEKDAY_NAMES_SHORT
} from '../api/client';

interface ThaiDatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({
  value = '',
  onChange,
  placeholder = 'เลือกวันที่ (พ.ศ.)',
  className = '',
  disabled = false,
  required = false,
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial view year and month (Gregorian)
  const initialDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState<number>(
    isNaN(initialDate.getFullYear()) ? new Date().getFullYear() : initialDate.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    isNaN(initialDate.getMonth()) ? new Date().getMonth() : initialDate.getMonth()
  );

  // Sync view when value changes from outside
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Handle outside click to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setViewYear(y);
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Generate days for viewMonth and viewYear
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Selected date components
  let selectedYear: number | null = null;
  let selectedMonth: number | null = null;
  let selectedDay: number | null = null;
  if (value) {
    const parts = value.split('-');
    if (parts.length === 3) {
      selectedYear = parseInt(parts[0], 10);
      selectedMonth = parseInt(parts[1], 10) - 1;
      selectedDay = parseInt(parts[2], 10);
    }
  }

  // Today components
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  // Years for selector: 10 years back, 10 years forward in Buddhist Era
  const currentBE = toBuddhistYear(todayYear);
  const buddhistYears: number[] = [];
  for (let be = currentBE - 10; be <= currentBE + 10; be++) {
    buddhistYears.push(be);
  }

  const formattedDisplayText = value ? formatThaiDate(value) : '';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-[#ecddc8] rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-[#8b5537] focus:border-transparent ${
          disabled ? 'opacity-60 cursor-not-allowed bg-stone-50' : 'cursor-pointer hover:border-[#8b5537]'
        } ${value ? 'text-[#321d14] font-medium' : 'text-stone-400'}`}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className="w-4 h-4 text-[#ba8452] shrink-0" />
          <span className="truncate">{formattedDisplayText || placeholder}</span>
        </div>

        <div className="flex items-center gap-1">
          {value && !disabled && (
            <span
              onClick={handleClear}
              title="ล้างวันที่"
              className="p-0.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 z-50 w-72 bg-white rounded-2xl shadow-xl border border-[#ecddc8] p-3 text-stone-800 animate-in fade-in zoom-in-95 duration-150">
          {/* Header with Month & Buddhist Year Selectors */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f3ece2]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-[#f7f1e7] text-stone-600 transition"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month selector */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-[#fdfaf6] border border-[#ecddc8] text-xs font-semibold text-[#5c3b2b] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#8b5537] cursor-pointer"
              >
                {THAI_MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Buddhist Year selector */}
              <select
                value={toBuddhistYear(viewYear)}
                onChange={(e) => setViewYear(toGregorianYear(parseInt(e.target.value, 10)))}
                className="bg-[#fdfaf6] border border-[#ecddc8] text-xs font-bold text-[#8b5537] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#8b5537] cursor-pointer"
              >
                {buddhistYears.map((be) => (
                  <option key={be} value={be}>
                    พ.ศ. {be}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-[#f7f1e7] text-stone-600 transition"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {THAI_WEEKDAY_NAMES_SHORT.map((wd, i) => (
              <span
                key={wd}
                className={`text-[11px] font-semibold ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-stone-500'
                }`}
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank/Prev month days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => {
              const d = daysInPrevMonth - firstDayOfWeek + i + 1;
              return (
                <span
                  key={`prev-${i}`}
                  className="h-8 flex items-center justify-center text-xs text-stone-300 select-none"
                >
                  {d}
                </span>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected =
                selectedYear === viewYear && selectedMonth === viewMonth && selectedDay === day;
              const isToday =
                todayYear === viewYear && todayMonth === viewMonth && todayDay === day;

              return (
                <button
                  key={`cur-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 w-8 mx-auto rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? 'bg-[#8b5537] text-white font-bold shadow-xs'
                      : isToday
                      ? 'border border-[#8b5537] text-[#8b5537] font-bold hover:bg-[#f7f1e7]'
                      : 'hover:bg-[#fdfaf6] text-stone-700'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Actions */}
          <div className="mt-3 pt-2 border-t border-[#f3ece2] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-[#8b5537] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Clock className="w-3 h-3" />
              <span>วันนี้ (พ.ศ. {currentBE})</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-stone-400 hover:text-stone-700 transition cursor-pointer"
              >
                ล้างค่า
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

