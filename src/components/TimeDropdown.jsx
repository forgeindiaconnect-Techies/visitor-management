import React, { useState, useEffect } from 'react';

const TimeDropdown = ({ value, onChange, name, className }) => {
  const [hour, setHour] = useState('10');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState('AM');

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      let hr = parseInt(h, 10);
      const isPm = hr >= 12;
      setAmpm(isPm ? 'PM' : 'AM');
      hr = hr % 12;
      hr = hr === 0 ? 12 : hr;
      setHour(hr.toString().padStart(2, '0'));
      setMinute(m.padStart(2, '0'));
    }
  }, [value]);

  const handleTimeChange = (newHour, newMinute, newAmpm) => {
    let hr24 = parseInt(newHour, 10);
    if (newAmpm === 'PM' && hr24 !== 12) hr24 += 12;
    if (newAmpm === 'AM' && hr24 === 12) hr24 = 0;
    
    const formatted24 = `${hr24.toString().padStart(2, '0')}:${newMinute}`;
    onChange({ target: { name, value: formatted24 } });
  };

  return (
    <div className="flex items-center gap-1.5 w-full">
      <select 
        value={hour} 
        onChange={(e) => handleTimeChange(e.target.value, minute, ampm)}
        className={`${className} !px-1 sm:!px-2 min-w-0 flex-1 text-center`}
      >
        {Array.from({length: 12}, (_, i) => {
          const val = (i + 1).toString().padStart(2, '0');
          return <option key={val} value={val}>{val}</option>;
        })}
      </select>
      
      <span className="font-bold text-gray-500">:</span>
      
      <select 
        value={minute} 
        onChange={(e) => handleTimeChange(hour, e.target.value, ampm)}
        className={`${className} !px-1 sm:!px-2 min-w-0 flex-1 text-center`}
      >
        {Array.from({length: 60}, (_, i) => {
          const val = i.toString().padStart(2, '0');
          return <option key={val} value={val}>{val}</option>;
        })}
      </select>
      
      <select 
        value={ampm} 
        onChange={(e) => handleTimeChange(hour, minute, e.target.value)}
        className={`${className} !px-1 sm:!px-2 min-w-0 flex-1 text-center`}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default TimeDropdown;
