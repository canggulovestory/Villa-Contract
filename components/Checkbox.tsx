import React from 'react';

interface CheckboxProps {
  id?: string;
  name?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  name,
  checked = false,
  onChange,
  disabled = false,
  label,
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.checked);
  };

  return (
    <div className={`flex items-center ${className}`}>
      <input
        id={id}
        type="checkbox"
        name={name}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="w-4 h-4 accent-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
      />
      {label && (
        <label htmlFor={id} className="ml-2 text-sm text-gray-700">
          {label}
        </label>
      )}
    </div>
  );
};
