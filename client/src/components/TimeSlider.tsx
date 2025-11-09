import { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause } from "lucide-react";
import { format, addDays } from "date-fns";

interface TimeSliderProps {
  onDateChange?: (date: Date) => void;
  onDayIndexChange?: (dayIndex: number) => void;
  dayIndex?: number;
}

export default function TimeSlider({ 
  onDateChange, 
  onDayIndexChange,
  dayIndex: controlledDayIndex 
}: TimeSliderProps) {
  const [internalDayIndex, setInternalDayIndex] = useState(controlledDayIndex ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastCommittedIndex = useRef(controlledDayIndex ?? 0);
  const commitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  
  // Use controlled dayIndex if provided, otherwise use internal state
  const dayIndex = controlledDayIndex !== undefined ? controlledDayIndex : internalDayIndex;

  // Sync internal state when controlled dayIndex changes
  useEffect(() => {
    if (controlledDayIndex !== undefined) {
      setInternalDayIndex(controlledDayIndex);
      lastCommittedIndex.current = controlledDayIndex;
      // Clear any pending commits when controlled value changes externally
      if (commitTimeoutRef.current) {
        clearTimeout(commitTimeoutRef.current);
        commitTimeoutRef.current = null;
      }
      pendingIndexRef.current = null;
    }
  }, [controlledDayIndex]);

  // Memoize dates array to prevent recalculation on every render
  const dates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []); // Remove initialDate dependency since we always want to start from today

  // Handle slider value changes - debounce to prevent skipping
  const handleSliderChange = (value: number[]) => {
    const newIndex = Math.round(value[0]);
    const clampedIndex = Math.max(0, Math.min(6, newIndex));
    
    // Update local state for visual feedback during drag
    if (controlledDayIndex === undefined) {
      setInternalDayIndex(clampedIndex);
    }
    
    // Store the pending index in a ref so the timeout always uses the latest value
    pendingIndexRef.current = clampedIndex;
    
    // Clear any pending commit
    if (commitTimeoutRef.current) {
      clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = null;
    }
    
    // Debounce the commit - only commit after user stops dragging for 150ms
    commitTimeoutRef.current = setTimeout(() => {
      // Get the most recent pending index (in case user moved slider during timeout)
      const indexToCommit = pendingIndexRef.current;
      
      // Only commit if we have a valid index and it's different from last committed
      if (indexToCommit !== null && indexToCommit !== lastCommittedIndex.current) {
        lastCommittedIndex.current = indexToCommit;
        pendingIndexRef.current = null;
        
        if (controlledDayIndex === undefined) {
          setInternalDayIndex(indexToCommit);
        }
        onDayIndexChange?.(indexToCommit);
        onDateChange?.(dates[indexToCommit]);
      }
      
      commitTimeoutRef.current = null;
    }, 150);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (commitTimeoutRef.current) {
        clearTimeout(commitTimeoutRef.current);
      }
    };
  }, []);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    console.log(`Time slider ${!isPlaying ? 'playing' : 'paused'}`);
  };

  return (
    <Card className="p-4" data-testid="card-time-slider">
      <div className="flex items-center gap-4">
        <Button
          size="icon"
          variant="outline"
          onClick={togglePlay}
          data-testid="button-play-pause"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        <div className="flex-1 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium" data-testid="selected-date">
              {dayIndex === 0 ? 'Today' : format(dates[dayIndex], "EEEE, MMM d")}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {dayIndex === 0 ? 'Today' : `${dayIndex} ${dayIndex === 1 ? 'day' : 'days'} ahead`}
            </span>
          </div>
          
          <Slider
            value={[dayIndex]}
            onValueChange={handleSliderChange}
            max={6}
            min={0}
            step={1}
            className="w-full"
            data-testid="slider-time"
          />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            {dates.map((date, idx) => (
              <span 
                key={idx} 
                className={idx === dayIndex ? "font-semibold text-foreground" : ""}
                data-testid={`day-label-${idx}`}
              >
                {idx === 0 ? 'Today' : format(date, "EEE")}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
