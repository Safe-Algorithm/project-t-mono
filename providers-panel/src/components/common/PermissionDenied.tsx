import React from 'react';

interface PermissionDeniedProps {
  message?: string;
  action?: string;
}

const PermissionDenied: React.FC<PermissionDeniedProps> = ({
  message,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V9m0 0V7m0 2h2m-2 0H10M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
      <p className="text-gray-500 max-w-sm">
        {message || (
          action
            ? `You don't have permission to ${action}.`
            : "You don't have permission to view this page or perform this action."
        )}
      </p>
      <p className="text-gray-400 text-sm mt-3">
        Contact your workspace owner to request access.
      </p>
    </div>
  );
};

export default PermissionDenied;
