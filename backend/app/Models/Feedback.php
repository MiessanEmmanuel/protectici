<?php

namespace App\Models;

use App\Services\Feedback\VoiceNoteStore;
use Database\Factories\FeedbackFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * « Dis-moi tout » : données personnelles privées, jamais exposées par l'API publique.
 *
 * @property Carbon|null $created_at
 * @property Carbon|null $consent_at
 * @property Carbon|null $resolved_at
 * @property string|null $voice_disk
 * @property string|null $voice_path
 * @property string|null $voice_mime
 * @property int|null $voice_size_bytes
 * @property int|null $voice_duration_seconds
 */
class Feedback extends Model
{
    /** @use HasFactory<FeedbackFactory> */
    use HasFactory, SoftDeletes;

    protected $table = 'feedbacks';

    protected $fillable = [
        'civility', 'last_name', 'first_name', 'email', 'phone', 'provider_id', 'action_type', 'target_type',
        'service_type_id', 'topic_id', 'product_type', 'location', 'comment',
    ];

    // Les colonnes voice_* ne sont jamais remplissables par l'utilisateur (écrites par VoiceNoteStore via forceFill).
    protected $hidden = ['ip_hash', 'voice_disk', 'voice_path'];

    protected function casts(): array
    {
        return [
            'consent_at' => 'datetime',
            'resolved_at' => 'datetime',
            'voice_size_bytes' => 'integer',
            'voice_duration_seconds' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // Suppression définitive : le message vocal (donnée personnelle) disparaît avec le dossier.
        static::forceDeleted(function (Feedback $feedback): void {
            app(VoiceNoteStore::class)->delete($feedback->voice_disk, $feedback->voice_path);
        });
    }

    public function hasVoice(): bool
    {
        return $this->voice_path !== null && $this->voice_disk !== null;
    }

    /** @return BelongsTo<Provider, $this> */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class);
    }

    /** @return BelongsTo<ServiceType, $this> */
    public function serviceType(): BelongsTo
    {
        return $this->belongsTo(ServiceType::class);
    }

    /** @return BelongsTo<FeedbackTopic, $this> */
    public function topic(): BelongsTo
    {
        return $this->belongsTo(FeedbackTopic::class, 'topic_id');
    }

    /** @return BelongsTo<User, $this> */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /** @return HasMany<FeedbackReply, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(FeedbackReply::class);
    }
}
