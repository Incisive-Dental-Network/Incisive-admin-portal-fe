'use client';

import { ServerCrash, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ServerErrorProps {
  message?: string;
}

export function ServerError({ message }: ServerErrorProps) {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
            <ServerCrash className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Server Unavailable
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message || 'Unable to connect to the server. Please try again later.'}
        </p>
        
        <div className="space-y-3">
          <Button
            onClick={handleRetry}
            leftIcon={<RefreshCw className="h-4 w-4" />}
            className="w-full"
          >
            Try Again
          </Button>
          
          <p className="text-sm text-gray-500 dark:text-gray-500">
            If the problem persists, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
