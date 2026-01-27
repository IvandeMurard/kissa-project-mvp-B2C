import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Types pour Supabase Realtime
type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';
type BroadcastPayload = {
  payload?: { id?: string | number };
  id?: string | number;
};

export const useRemoteControl = (
  onRemoteSelect?: (albumId: string | number) => void
) => {
  const onRemoteSelectRef = useRef(onRemoteSelect);
  onRemoteSelectRef.current = onRemoteSelect;

  // Fonction pour EMETTRE (Mobile -> Desktop)
  const broadcastSelection = useCallback(async (albumId: string | number) => {
    if (!supabase) {
      console.debug('Supabase client not available for broadcasting');
      return;
    }
    const client = supabase;

    let channel: ReturnType<typeof client.channel> | null = null;

    try {
      channel = client.channel('kissa-room');
      const channelRef = channel; // Référence locale pour le callback

      // Timeout pour éviter que le channel reste ouvert indéfiniment
      const timeoutId = setTimeout(() => {
        if (channelRef) {
          client.removeChannel(channelRef);
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
            clearTimeout(timeoutId);
            if (channelRef) {
              client.removeChannel(channelRef);
            }
          }
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          clearTimeout(timeoutId);
          if (channelRef) {
            client.removeChannel(channelRef);
          }
        }
      });
    } catch (error) {
      console.debug('Error broadcasting selection:', error);
      if (channel) {
        client.removeChannel(channel);
      }
    }
  }, []);

  // Fonction pour RECEVOIR (Desktop) — ref pour éviter de se réabonner à chaque changement de onRemoteSelect/allAlbums
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel('kissa-room');
    console.log('📡 Listening on channel kissa-room');

    channel
      .on('broadcast', { event: 'select_album' }, (payload: BroadcastPayload) => {
        const id = payload.payload?.id ?? payload.id;
        if (id !== undefined && id !== null) {
          console.log('📡 Signal reçu:', id);
          onRemoteSelectRef.current?.(id);
        }
      })
      .subscribe();

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  return { broadcastSelection };
};
