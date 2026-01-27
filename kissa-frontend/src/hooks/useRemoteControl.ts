import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Types pour Supabase Realtime
type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';
type BroadcastPayload = {
  payload: {
    id: string | number;
  };
};

export const useRemoteControl = (
  onRemoteSelect?: (albumId: string | number) => void
) => {
  
  // Fonction pour EMETTRE (Mobile -> Desktop)
  const broadcastSelection = useCallback(async (albumId: string | number) => {
    if (!supabase) {
      console.debug('Supabase client not available for broadcasting');
      return;
    }
    
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    try {
      channel = supabase.channel('kissa-room');
      const channelRef = channel; // Référence locale pour le callback
      
      // Timeout pour éviter que le channel reste ouvert indéfiniment
      const timeoutId = setTimeout(() => {
        if (channelRef) {
          supabase.removeChannel(channelRef);
        }
      }, 5000); // 5 secondes max
      
      await channelRef.subscribe(async (status: ChannelStatus) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channelRef.send({
              type: 'broadcast',
              event: 'select_album',
              payload: { id: albumId },
            });
          } catch (sendError) {
            console.debug('Error sending broadcast:', sendError);
          } finally {
            // On se désabonne tout de suite après l'envoi pour ne pas laisser traîner
            clearTimeout(timeoutId);
            if (channelRef) {
              supabase.removeChannel(channelRef);
            }
          }
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          // Nettoyer en cas d'erreur ou de fermeture
          clearTimeout(timeoutId);
          if (channelRef) {
            supabase.removeChannel(channelRef);
          }
        }
      });
    } catch (error) {
      // Gérer silencieusement les erreurs de connexion (ne pas bloquer l'UI)
      console.debug('Error broadcasting selection:', error);
      if (channel) {
        supabase.removeChannel(channel);
      }
    }
  }, []);

  // Fonction pour RECEVOIR (Desktop)
  useEffect(() => {
    if (!onRemoteSelect) return; // Si pas de callback, on n'écoute pas (mode émetteur seul)
    if (!supabase) return; // Si Supabase n'est pas disponible, on n'écoute pas

    const channel = supabase.channel('kissa-room');
    console.log('📡 Listening on channel kissa-room');

    channel
      .on('broadcast', { event: 'select_album' }, (payload: BroadcastPayload) => {
        console.log('📡 Signal reçu:', payload);
        if (payload.payload?.id !== undefined) {
          onRemoteSelect(payload.payload.id);
        }
      })
      .subscribe();

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [onRemoteSelect]);

  return { broadcastSelection };
};
