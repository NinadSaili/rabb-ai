package com.rabbai.blocking

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Block screen shown over a selected app. Always offers a way out: open Rabb.ai, emergency bypass, or go back. */
class BlockActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (24 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(pad, pad, pad, pad); setBackgroundColor(0xFFFAF7F0.toInt()) }
        root.addView(TextView(this).apply { text = getString(R.string.rabb_block_title); textSize = 24f; setTextColor(0xFF1F1F1D.toInt()); contentDescription = text })
        root.addView(TextView(this).apply { text = getString(R.string.rabb_block_body); textSize = 18f; setTextColor(0xFF1F1F1D.toInt()); setPadding(0, pad / 2, 0, pad) })
        root.addView(Button(this).apply { text = getString(R.string.rabb_block_open); setOnClickListener { open("rabbai://ritual") } })
        root.addView(Button(this).apply { text = getString(R.string.rabb_block_bypass); setOnClickListener { open("rabbai://privacy") } })
        root.addView(Button(this).apply { text = getString(R.string.rabb_block_close); setOnClickListener { goHome() } })
        setContentView(root)
    }

    private fun open(uri: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri)).setPackage(packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }

    private fun goHome() {
        startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }

    @Deprecated("Back always leaves the block screen, never traps the user")
    override fun onBackPressed() { goHome() }
}
