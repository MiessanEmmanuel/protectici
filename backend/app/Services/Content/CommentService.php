<?php

namespace App\Services\Content;

use App\Models\IdempotencyKey;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\PlainText;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Commentaires du blog : création (toujours « en attente »), idempotente, puis modération par la rédaction. */
class CommentService
{
    private const SCOPE = 'blog_comment';

    public function __construct(private readonly AuditLogger $audit) {}

    /** @param array<string, mixed> $data  body, parent_id? */
    public function create(User $user, Post $post, array $data, ?string $idempotencyKey): PostComment
    {
        $body = (string) PlainText::multiline((string) $data['body']);
        $parentId = isset($data['parent_id']) ? (int) $data['parent_id'] : null;
        $hash = hash('sha256', json_encode([$post->id, $parentId, $body], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

        if ($idempotencyKey !== null && ($existing = $this->replay($user, $idempotencyKey, $hash)) !== null) {
            return $existing;
        }

        if ($parentId !== null) {
            // Une seule profondeur : on ne répond qu'à un commentaire racine, publié, du même article.
            $parent = PostComment::query()->where('post_id', $post->id)->where('is_visible', true)->whereNull('parent_id')->find($parentId);
            if ($parent === null) {
                throw ValidationException::withMessages(['parent_id' => ['Le commentaire auquel vous répondez est introuvable.']]);
            }
        }

        try {
            return DB::transaction(function () use ($user, $post, $parentId, $body, $idempotencyKey, $hash) {
                if ($idempotencyKey !== null) {
                    $key = IdempotencyKey::create(['user_id' => $user->id, 'scope' => self::SCOPE, 'key' => $idempotencyKey, 'request_hash' => $hash]);
                }

                $comment = (new PostComment)->fill(['post_id' => $post->id, 'parent_id' => $parentId, 'body' => $body]);
                $comment->forceFill(['user_id' => $user->id, 'status' => 'pending', 'is_visible' => false])->save();

                if (isset($key)) {
                    $key->forceFill(['resource_type' => 'post_comment', 'resource_id' => $comment->id])->save();
                }

                return $comment;
            });
        } catch (UniqueConstraintViolationException $e) {
            $existing = $idempotencyKey === null ? null : $this->replay($user, $idempotencyKey, $hash);
            if ($existing === null) {
                throw $e;
            }

            return $existing;
        }
    }

    public function moderate(User $actor, PostComment $comment, string $status): PostComment
    {
        return DB::transaction(function () use ($actor, $comment, $status) {
            $locked = PostComment::query()->whereKey($comment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === $status) {
                return $locked; // idempotent
            }
            $old = $locked->status;
            $locked->forceFill([
                'status' => $status,
                'is_visible' => $status === 'approved',
                'moderated_by' => $actor->id,
                'moderated_at' => now(),
            ])->save();

            // Rejeter / marquer comme indésirable un commentaire racine masque aussi ses réponses publiées.
            if ($status !== 'approved' && $locked->parent_id === null) {
                PostComment::query()->where('parent_id', $locked->id)->where('is_visible', true)
                    ->update(['is_visible' => false, 'status' => 'rejected', 'moderated_by' => $actor->id, 'moderated_at' => now()]);
            }

            $this->audit->record('post_comment_moderated', $locked, ['status' => $old], ['status' => $status], actor: $actor);

            return $locked;
        });
    }

    private function replay(User $user, string $key, string $hash): ?PostComment
    {
        $row = IdempotencyKey::query()->where('user_id', $user->id)->where('scope', self::SCOPE)->where('key', $key)->first();
        if ($row === null) {
            return null;
        }
        if (! hash_equals($row->request_hash, $hash)) {
            throw ValidationException::withMessages(['idempotency_key' => ['Cette clé d\'idempotence a déjà été utilisée avec une demande différente.']]);
        }
        $comment = $row->resource_id === null ? null : PostComment::query()->find($row->resource_id);
        if ($comment === null) {
            throw ValidationException::withMessages(['idempotency_key' => ['Cette clé d\'idempotence est déjà utilisée. Générez-en une nouvelle.']]);
        }

        return $comment;
    }
}
