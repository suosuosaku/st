export function EmptyPanel({ title, message }: { title: string, message?: string }) {
  return (
    <div className="h-full w-full glass-panel rounded-xl flex flex-col items-center justify-center p-5 md:p-8 text-center relative overflow-hidden">
       <div className="absolute inset-0 z-0 opacity-5 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-96 h-96 animate-[spin_120s_linear_infinite]">
            <polygon points="50,10 90,90 10,90" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="50" cy="60" r="20" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
       </div>

       <div className="relative z-10 max-w-md">
         <div className="text-3xl md:text-4xl mb-4 text-fantasy-gold opacity-50 font-serif">*</div>
         <h2 className="text-xl md:text-2xl font-serif text-gray-300 mb-2 tracking-widest">
            {title}
         </h2>
         <p className="text-sm text-gray-500 leading-relaxed">
            {message || '暂无有效记录。'}
         </p>

         <div className="mt-8 border border-white/5 bg-black/40 p-4 rounded text-xs text-left">
           <div className="text-fantasy-gold mb-1">封存页：</div>
           <p className="text-gray-400">尚未登记地点、权限或同行者。</p>
         </div>
       </div>
    </div>
  );
}
