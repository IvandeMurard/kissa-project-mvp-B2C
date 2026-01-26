import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const useRemoteControl = (
  onRemoteSelect?: (albumId: string | number) => void
) => {
  
  // Fonction pour EMETTRE (Mobile -> Desktop)
  const broadcastSelection = async (albumId: string | number) => {
    if (!supabase) {
      console.debug('Supabase client not available for broadcasting');
      return;
    }
    
    try {
      const channel = supabase.channel('kissa-room');
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'select_album',
            payload: { id: albumId },
          });
          // On se désabonne tout de suite après l'envoi pour ne pas laisser traîner
          supabase.removeChannel(channel);
        }
      });
    } catch (error) {
      // Gérer silencieusement les erreurs de connexion (ne pas bloquer l'UI)
      console.debug('Error broadcasting selection:', error);
    }
  };

  // Fonction pour RECEVOIR (Desktop)
  useEffect(() => {
    if (!onRemoteSelect) return; // Si pas de callback, on n'écoute pas (mode émetteur seul)
    if (!supabase) return; // Si Supabase n'est pas disponible, on n'écoute pas

    const channel = supabase.channel('kissa-room');

    channel
      .on('broadcast', { event: 'select_album' }, (payload) => {
        console.log('📡 Signal reçu:', payload);
        if (payload.payload?.id) {
          onRemoteSelect(payload.payload.id);
        }
      })
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [onRemoteSelect]);

  return { broadcastSelection };
};
