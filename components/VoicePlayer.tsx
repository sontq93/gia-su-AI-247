
import React, { useEffect, useRef } from 'react';

interface VoicePlayerProps {
  base64Audio: string;
  onEnded?: () => void;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ base64Audio, onEnded }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (!base64Audio) return;

    const playAudio = async () => {
      // Dọn dẹp phiên trước nếu có
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;
      
      const decode = (base64: string) => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      };

      const decodeAudioData = async (data: Uint8Array, ctx: AudioContext) => {
        const dataInt16 = new Int16Array(data.buffer);
        const frameCount = dataInt16.length;
        const buffer = ctx.createBuffer(1, frameCount, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = dataInt16[i] / 32768.0;
        }
        return buffer;
      };

      try {
        const decodedBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(decodedBytes, audioCtx);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        sourceRef.current = source;
        
        source.onended = () => {
          if (onEnded) onEnded();
        };
        
        source.start();
      } catch (err) {
        console.error("Audio playback error", err);
        if (onEnded) onEnded();
      }
    };

    playAudio();

    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [base64Audio]);

  return null;
};
