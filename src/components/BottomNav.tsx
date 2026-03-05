import { Home, Camera, Users, Folder } from 'lucide-react';

interface Props {
  active: 'home' | 'scan' | 'people' | 'files';
  onHome?: () => void;
  onScan?: () => void;
  onFriends?: () => void;
  onFiles?: () => void;
}

export function BottomNav({ active, onHome, onScan, onFriends, onFiles }: Props) {
  const items = [
    { id: 'home' as const, icon: Home, label: 'Home', action: onHome },
    { id: 'scan' as const, icon: Camera, label: 'Scan', action: onScan },
    { id: 'people' as const, icon: Users, label: 'People', action: onFriends },
    { id: 'files' as const, icon: Folder, label: 'Files', action: onFiles },
  ];

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-maroon rounded-full px-4 py-3 shadow-lg shadow-maroon/30">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                isActive ? 'bg-white' : 'bg-transparent hover:bg-white/10'
              }`}
            >
              <item.icon
                className={`w-5 h-5 ${isActive ? 'text-maroon' : 'text-white/80'}`}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
