

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import SendIcon from '../components/icons/SendIcon';
import AIAssistantIcon from '../components/icons/AIAssistantIcon';
import UserIcon from '../components/icons/UserIcon';

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

interface AIAssistantProps {
  geminiApiKey: string | null;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ geminiApiKey }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const formatResponse = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/g, '<em>$1</em>')
               .replace(/\n/g, '<br />');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { sender: 'user', text: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    if (!geminiApiKey) {
        const errorMessage: Message = {
            sender: 'ai',
            text: 'Lỗi: Gemini API Key chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
        };
        setMessages((prev) => [...prev, errorMessage]);
        setLoading(false);
        return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userMessage.text,
        config: {
            systemInstruction: 'Bạn là một trợ lý AI hữu ích trong hệ thống quản lý đào tạo liên tục của một bệnh viện tại Việt Nam. Hãy trả lời các câu hỏi của người dùng một cách ngắn gọn, chuyên nghiệp và chính xác. Sử dụng tiếng Việt.'
        }
      });

      const aiMessage: Message = { sender: 'ai', text: response.text };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Gemini API error:', error);
      const errorMessage: Message = {
        sender: 'ai',
        text: 'Rất tiếc, đã xảy ra lỗi khi kết nối với trợ lý AI. Vui lòng thử lại sau.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-140px)] bg-white rounded-lg shadow-md">
      <header className="p-4 border-b border-gray-200">
        <h1 className="text-xl md:text-2xl font-bold text-teal-800">Trợ lý AI</h1>
        <p className="text-base text-gray-500">Đặt câu hỏi liên quan đến quản lý đào tạo liên tục</p>
      </header>

      <main className="flex-1 p-4 overflow-y-auto bg-gray-50">
        <div className="space-y-6">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'ai' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                  <AIAssistantIcon className="w-5 h-5 text-teal-600" />
                </div>
              )}
              <div
                className={`max-w-lg p-3 rounded-xl shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-teal-600 text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none border'
                }`}
              >
                <p className="text-base" dangerouslySetInnerHTML={{ __html: formatResponse(msg.text) }} />
              </div>
               {msg.sender === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-gray-600" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-3 justify-start">
               <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                  <AIAssistantIcon className="w-5 h-5 text-teal-600" />
                </div>
              <div className="max-w-lg p-3 rounded-xl shadow-sm bg-white text-gray-800 rounded-bl-none border">
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer className="p-4 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi Trợ lý AI về quản lý đào tạo..."
            disabled={loading}
            className="flex-1 w-full px-4 py-2 border border-gray-300 rounded-full shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition disabled:bg-gray-100"
            aria-label="Chat input"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-teal-600 text-white rounded-full hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors duration-200 disabled:bg-teal-400 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default AIAssistant;