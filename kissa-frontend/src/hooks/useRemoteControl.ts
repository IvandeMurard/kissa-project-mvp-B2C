import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Types pour Supabase Realtime
type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';
type BroadcastPayload = {
  payload?: { id?: string | number };
  id?: string | number;
};

export type RemoteControlActions = {
  broadcastSelection: (albumId: string | number) => Promise<void>;
  broadcastAlbumUpdate: (albumId: string) => Promise<void>;
};

export const useRemoteControl = (
  onRemoteSelect?: (albumId: string | number) => void,
  onAlbumUpdated?: (albumId: string) => void
): RemoteControlActions => {
  const onRemoteSelectRef = useRef(onRemoteSelect);
  onRemoteSelectRef.current = onRemoteSelect;
  const onAlbumUpdatedRef = useRef(onAlbumUpdated);
  onAlbumUpdatedRef.current = onAlbumUpdated;

  // Fonction pour EMETTRE (Mobile -> Desktop)
  const broadcastSelection = useCallback(async (albumId: string | number) => {
    if (!supabase) {
      console.debug('Supabase client not available for broadcasting');
      return;
    }
    const client = supabase;

    let channel: ReturnType<typeof client.channel> | null = null;
    let cleaned = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

    try {
      channel = client.channel('kissa-room');
      const channelRef = channel;

      const safeRemove = () => {
        if (cleaned) return;
        cleaned = true;
        clearTimeout(timeoutId);
        queueMicrotask(() => {
          try {
            if (channelRef) client.removeChannel(channelRef);
          } catch (e) {
            console.debug('Error removing channel:', e);
          }
        });
      };

      timeoutId = setTimeout(safeRemove, 5000);

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
            safeRemove();
          }
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          safeRemove();
        }
      });
    } catch (error) {
      console.debug('Error broadcasting selection:', error);
      if (!cleaned && channel) {
        cleaned = true;
        if (typeof timeoutId !== 'undefined') clearTimeout(timeoutId);
        queueMicrotask(() => {
          try {
            client.removeChannel(channel!);
          } catch (e) {
            console.debug('Error removing channel:', e);
          }
        });
      }
    }
  }, []);

  // Émettre un broadcast "album_updated" après une mutation (mood, acquisition, etc.)
  const broadcastAlbumUpdate = useCallback(async (albumId: string) => {
    if (!supabase) {
      console.debug('Supabase client not available for broadcasting');
      return;
    }
    const client = supabase;
    let channel: ReturnType<typeof client.channel> | null = null;
    let cleaned = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

    try {
      channel = client.channel('kissa-room');
      const channelRef = channel;

      const safeRemove = () => {
        if (cleaned) return;
        cleaned = true;
        clearTimeout(timeoutId);
        queueMicrotask(() => {
          try {
            if (channelRef) client.removeChannel(channelRef);
          } catch (e) {
            console.debug('Error removing channel:', e);
          }
        });
      };

      timeoutId = setTimeout(safeRemove, 5000);

      await channelRef.subscribe(async (status: ChannelStatus) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channelRef.send({
              type: 'broadcast',
              event: 'album_updated',
              payload: { id: albumId },
            });
          } catch (sendError) {
            console.debug('Error sending album_updated:', sendError);
          } finally {
            safeRemove();
          }
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          safeRemove();
        }
      });
    } catch (error) {
      console.debug('Error broadcasting album_updated:', error);
      if (!cleaned && channel) {
        cleaned = true;
        if (typeof timeoutId !== 'undefined') clearTimeout(timeoutId);
        queueMicrotask(() => {
          try {
            client.removeChannel(channel!);
          } catch (e) {
            console.debug('Error removing channel:', e);
          }
        });
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
      .on('broadcast', { event: 'album_updated' }, (payload: BroadcastPayload) => {
        const id = payload.payload?.id ?? payload.id;
        if (id != null) onAlbumUpdatedRef.current?.(String(id));
      })
      .subscribe();

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  return { broadcastSelection, broadcastAlbumUpdate };
};
