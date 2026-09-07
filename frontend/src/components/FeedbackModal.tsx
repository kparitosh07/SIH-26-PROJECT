import { useState } from 'react';
import { Star, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { Button, Modal } from './UI';
import { feedbackApi } from '../services/api';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'general', label: 'General Feedback' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'ui_ux', label: 'UI / UX Design' },
  { value: 'ocr_accuracy', label: 'OCR & Compliance Accuracy' },
];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string>('general');
  const [comments, setComments] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      toast.error('Please select a star rating');
      return;
    }

    setIsSubmitting(true);
    try {
      await feedbackApi.submit({
        rating,
        category,
        comments: comments.trim() || undefined,
      });
      setIsSubmitted(true);
      toast.success('Thank you for rating our application!');
      setTimeout(() => {
        setIsSubmitted(false);
        setComments('');
        setRating(5);
        onClose();
      }, 1500);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to submit feedback'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRating = hoverRating !== null ? hoverRating : rating;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rate & Send Feedback" size="md">
      {isSubmitted ? (
        <div className="py-8 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-success-500 mx-auto animate-bounce" />
          <h3 className="text-lg font-semibold text-gray-900">Feedback Submitted!</h3>
          <p className="text-sm text-gray-500">Your feedback helps us continuously improve the application.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star Rating */}
          <div className="text-center space-y-2">
            <label className="block text-sm font-medium text-gray-700">How would you rate your experience?</label>
            <div className="flex justify-center items-center gap-1.5 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`Rate ${star} out of 5 stars`}
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= currentRating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-300'
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs text-amber-600 font-medium">
              {currentRating === 5 && 'Outstanding! ⭐⭐⭐⭐⭐'}
              {currentRating === 4 && 'Very Good! ⭐⭐⭐⭐'}
              {currentRating === 3 && 'Good / Average ⭐⭐⭐'}
              {currentRating === 2 && 'Needs Improvement ⭐⭐'}
              {currentRating === 1 && 'Poor Experience ⭐'}
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comments / Suggestions <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              maxLength={1000}
              placeholder="Tell us what you liked or what we can improve..."
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              {comments.length}/1000
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" /> Submit Feedback
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
