import { useRef, useEffect, useState } from "react";
import Copy from "../assets/Copy.svg";


interface MessageProps {
  text: string;
  sender: string;
  image:string;
  anim:boolean;
}

export default function MessageBubble({ text, sender,image,anim }: MessageProps) {
  const messageRef = useRef<HTMLDivElement>(null);
  const [displayedText, setDisplayedText] = useState(sender === "user" ? text : ""); 
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (sender === "ai" || sender === "system") {
      if(!anim)
      {
        setDisplayedText(""); 
        
      }
      else
      {
        setDisplayedText(text); 
        return;
      }
        let index = 0;

        const interval = setInterval(() => {
          setDisplayedText((prev) => text.slice(0, index + 1)); 
          index++;

          if (index >= text.length) {
            clearInterval(interval);
          }
        }, 10);

        return () => clearInterval(interval);
      }
    
    
  }, [text, sender]);

  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.style.height = "auto";
      messageRef.current.style.height = `${messageRef.current.scrollHeight}px`;
    }
  }, [displayedText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`flex lg:max-w-[770px] min-w-[200px] md:min-w-[500px] lg:min-w-[800px] flex-col items-${sender === "user" ? "end" : (sender === "system" ? "center" : "start")}`}>
      <div className={`flex items-center gap-2 pt-2 ${sender === "user" ? "justify-end" : "justify-start"}`}>
        {sender === "ai" && (
          <img
            src={image}
            alt="Avatar"
            className="w-8 h-8 rounded-xl"
            style={{
              backgroundColor: "var(--white)",
              border: "1px solid var(--gray-even-darker)",
            }}
          />
        )}
        {sender === "system" && (
          <div className="w-8 h-8 rounded-xl bg-purple-900/60 flex items-center justify-center text-[10px] font-bold text-purple-200 shadow-inner border border-purple-700/50">
            ND
          </div>
        )}
        <div
          ref={messageRef}
          className={`p-3 rounded-xl max-w-lg sm:max-w-xl md:max-w-2xl text-mm overflow-hidden ${
            sender === "user"
              ? "bg-[var(--gray-almost-black)] text-[var(--white)] border border-[var(--gray-darker)]"
              : sender === "system"
              ? "bg-purple-950/40 text-purple-255 border border-purple-800/40 border-l-4 border-l-purple-500 italic"
              : "bg-[var(--page)] text-[var(--white)] border border-[var(--gray-darker)]"
          }`}
          style={{
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
          }}
        >
          {displayedText}
        </div>
      </div>
      {sender === "user" && (
        <div className="flex justify-end mt-2 gap-4 relative">
          <img src={Copy} alt="Copy icon" className="w-4 h-4 cursor-pointer" onClick={handleCopy} />
          {copied && (
            <span className="absolute -top-6 right-0 bg-black text-white text-xs rounded px-2 py-1 shadow-lg z-50">
              Copied!
            </span>
          )}
        </div>
      )}
    </div>
  );
}
