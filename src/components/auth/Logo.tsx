export default function Logo({ className = "" }: { className?: string }) {
    return (
        <div className={`flex items-center gap-4 font-bold text-3xl tracking-wider ${className}`}>
            <img 
                src="/favicon.ico" 
                alt="SAO6 Logo" 
                className="w-12 h-12 object-contain brightness-0 invert"
            />
            <span class="text-white drop-shadow-sm">SAO6</span>
        </div>
    );
}
